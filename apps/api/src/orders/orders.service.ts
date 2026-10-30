import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建订单
   */
  async createOrder(userId: string, data: {
    addressId: string;
    paymentMethod: string;
    buyerNote?: string;
    isPickup?: boolean;
    shippingRegion?: string;
  }) {
    // 1. 获取购物车
    const cart = await this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
    });

    if (cart.length === 0) {
      throw new BadRequestException('购物车为空');
    }

    // 2. 获取收货地址
    const address = await this.prisma.address.findUnique({
      where: { id: data.addressId },
    });

    if (!address) {
      throw new NotFoundException('地址不存在');
    }

    // 3. 计算金额（欧分）
    let subtotalCent = 0;
    const orderItems: any[] = [];

    for (const cartItem of cart) {
      const product = cartItem.product;

      // 检查库存
      if (product.stock < cartItem.quantity) {
        throw new BadRequestException(`商品 ${product.nameIt} 库存不足`);
      }

      const itemTotal = product.priceCent * cartItem.quantity;
      subtotalCent += itemTotal;

      orderItems.push({
        productId: product.id,
        quantity: cartItem.quantity,
        priceCent: product.priceCent,
        color: cartItem.color,
        size: cartItem.size,
      });
    }

    // 4. 计算运费（简化版，后续接入运费模板）
    const shippingCent = 499; // €4.99 基础运费
    const discountCent = 0; // 暂无优惠
    const totalCent = subtotalCent + shippingCent - discountCent;

    // 5. 生成订单号
    const orderNo = 'LQ' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 5).toUpperCase();

    // 6. 创建订单
    const order = await this.prisma.order.create({
      data: {
        orderNo,
        userId,
        subtotalCent,
        shippingCent,
        discountCent,
        totalCent,
        paymentMethod: data.paymentMethod,
        buyerNote: data.buyerNote,
        isPickup: data.isPickup || false,
        shippingRegion: data.shippingRegion || address.region || '',
        shippingAddress: address.detail,
        shippingPostcode: address.postcode || '',
        receiverName: address.name,
        receiverPhone: address.phone,
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 小时后
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                nameIt: true,
                nameZh: true,
                images: true,
              },
            },
          },
        },
      },
    });

    // 7. 扣减库存
    for (const item of orderItems) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 8. 清空购物车
    await this.prisma.cartItem.deleteMany({ where: { userId } });

    return {
      ...order,
      subtotal: order.subtotalCent / 100,
      shipping: order.shippingCent / 100,
      discount: order.discountCent / 100,
      total: order.totalCent / 100,
    };
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: string, query?: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (query?.status) {
      where.status = query.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  nameIt: true,
                  nameZh: true,
                  images: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map(order => ({
        ...order,
        subtotal: order.subtotalCent / 100,
        shipping: order.shippingCent / 100,
        discount: order.discountCent / 100,
        total: order.totalCent / 100,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取订单详情
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                nameIt: true,
                nameZh: true,
                images: true,
                priceCent: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            phone: true,
            name: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return {
      ...order,
      subtotal: order.subtotalCent / 100,
      shipping: order.shippingCent / 100,
      discount: order.discountCent / 100,
      total: order.totalCent / 100,
    };
  }

  /**
   * 更新订单状态（管理员）
   */
  async updateOrderStatus(orderId: string, status: OrderStatus, adminNote?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        adminNote: adminNote || order.adminNote,
      },
    });
  }

  /**
   * 取消订单（用户）
   */
  async cancelOrder(userId: string, orderId: string, reason?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        status: OrderStatus.PENDING_PAYMENT,
      },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('订单不存在或不可取消');
    }

    // 恢复库存
    for (const item of order.items) {
      await this.prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // 更新订单状态
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelReason: reason,
        cancelledAt: new Date(),
      },
    });
  }
}
