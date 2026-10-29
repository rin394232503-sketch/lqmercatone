import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户购物车
   */
  async getCart(userId: string) {
    const items = await this.prisma.cartItem.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            nameIt: true,
            nameZh: true,
            priceCent: true,
            oldPriceCent: true,
            images: true,
            stock: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 计算总价
    const totalCent = items.reduce((sum, item) => {
      return sum + item.product.priceCent * item.quantity;
    }, 0);

    return {
      items: items.map(item => ({
        ...item,
        product: {
          ...item.product,
          price: item.product.priceCent / 100,
          oldPrice: item.product.oldPriceCent ? item.product.oldPriceCent / 100 : null,
        },
        subtotal: (item.product.priceCent * item.quantity) / 100,
      })),
      total: totalCent / 100,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  /**
   * 添加商品到购物车
   */
  async addItem(userId: string, data: {
    productId: string;
    quantity: number;
    color?: string;
    size?: string;
  }) {
    // 检查商品是否存在
    const product = await this.prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new NotFoundException('商品不存在');
    }

    // 检查库存
    if (product.stock < data.quantity) {
      throw new Error('库存不足');
    }

    // 查找是否已存在相同商品（相同规格）
    const existingItem = await this.prisma.cartItem.findFirst({
      where: {
        userId,
        productId: data.productId,
        color: data.color || null,
        size: data.size || null,
      },
    });

    if (existingItem) {
      // 更新数量
      const newQuantity = existingItem.quantity + data.quantity;

      // 再次检查库存
      if (product.stock < newQuantity) {
        throw new Error('库存不足');
      }

      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
        include: {
          product: {
            select: {
              nameIt: true,
              priceCent: true,
              images: true,
            },
          },
        },
      });
    }

    // 创建新购物车项
    return this.prisma.cartItem.create({
      data: {
        userId,
        productId: data.productId,
        quantity: data.quantity,
        color: data.color,
        size: data.size,
      },
      include: {
        product: {
          select: {
            nameIt: true,
            priceCent: true,
            images: true,
          },
        },
      },
    });
  }

  /**
   * 更新购物车商品数量
   */
  async updateQuantity(userId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
      include: { product: true },
    });

    if (!item) {
      throw new NotFoundException('购物车项不存在');
    }

    if (quantity <= 0) {
      // 删除商品
      return this.prisma.cartItem.delete({ where: { id: itemId } });
    }

    // 检查库存
    if (item.product.stock < quantity) {
      throw new Error('库存不足');
    }

    return this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
  }

  /**
   * 删除购物车商品
   */
  async removeItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        userId,
      },
    });

    if (!item) {
      throw new NotFoundException('购物车项不存在');
    }

    return this.prisma.cartItem.delete({ where: { id: itemId } });
  }

  /**
   * 清空购物车
   */
  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId } });
  }

  /**
   * 合并购物车（游客→登录用户）
   */
  async mergeCart(userId: string, guestItems: Array<{
    productId: string;
    quantity: number;
    color?: string;
    size?: string;
  }>) {
    const results = [];

    for (const item of guestItems) {
      try {
        const result = await this.addItem(userId, item);
        results.push(result);
      } catch (error) {
        // 跳过失败的项目（库存不足等）
        console.error('合并购物车失败:', error.message);
      }
    }

    return results;
  }
}
