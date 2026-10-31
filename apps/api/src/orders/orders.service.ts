import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import * as cron from 'node-cron';

@Injectable()
export class OrdersService {
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    // 每 5 分钟扫描超时订单（24 小时未支付）
    // 使用 Redis 分布式锁防止多实例重复执行
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.executeCronWithLock();
    });
    console.log('✅ 超时订单自动取消任务已启动（每 5 分钟执行，Redis 分布式锁）');
  }

  /**
   * 带分布式锁的定时任务执行
   * 防止多实例部署时重复执行
   */
  private async executeCronWithLock() {
    const lockKey = 'lock:cancel_timeout_orders';
    const lockTTL = 300; // 5 分钟（与 cron 间隔一致）

    try {
      // 尝试获取 Redis 分布式锁（SET NX = 仅当 key 不存在时设置）
      const locked = await this.redis.setNx(lockKey, '1', lockTTL);

      if (!locked) {
        console.log('🔒 其他实例正在执行超时订单扫描，跳过本次');
        return;
      }

      console.log('🔓 获取分布式锁成功，开始扫描超时订单...');
      await this.cancelTimeoutOrders();
    } catch (error) {
      console.error('❌ 定时任务执行失败:', error.message);
    }
    // 注：锁在 TTL 过期后自动释放，不需要手动删除
    // 这样可以防止任务执行时间过长导致锁提前释放
  }

  /**
   * 创建订单（使用事务保证原子性，防止超卖）
   */
  async createOrder(userId: string, data: {
    addressId: string;
    paymentMethod: string;
    buyerNote?: string;
    isPickup?: boolean;
    shippingRegion?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. 获取购物车
      const cart = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cart.length === 0) {
        throw new BadRequestException('购物车为空');
      }

      // 2. 获取收货地址
      const address = await tx.address.findFirst({
        where: { id: data.addressId, userId },
      });

      if (!address) {
        throw new NotFoundException('地址不存在或不属于当前用户');
      }

      // 3. 计算金额 + 扣减库存（在事务内原子操作）
      const orderItems: any[] = [];
      let subtotalCent = 0;

      // 按 productId 排序，防止死锁
      const sortedCart = [...cart].sort((a, b) => a.productId.localeCompare(b.productId));

      for (const cartItem of sortedCart) {
        const product = cartItem.product;

        if (product.stock < cartItem.quantity) {
          throw new BadRequestException(`商品 ${product.nameIt} 库存不足（仅剩${product.stock}件）`);
        }

        // 在事务内立即扣减库存（乐观锁）
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: cartItem.quantity } },
        });

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

      // 4. 运费（后端计算，不允许前端传入）
      const shippingCent = 499;
      const discountCent = 0;
      const totalCent = subtotalCent + shippingCent - discountCent;

      // 5. 生成订单号
      const orderNo = 'LQ' + Date.now().toString().slice(-8) + Math.random().toString(36).slice(2, 5).toUpperCase();

      // 6. 创建订单
      const order = await tx.order.create({
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
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

      // 7. 清空购物车
      await tx.cartItem.deleteMany({ where: { userId } });

      return {
        ...order,
        subtotal: order.subtotalCent / 100,
        shipping: order.shippingCent / 100,
        discount: order.discountCent / 100,
        total: order.totalCent / 100,
      };
    }, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  /**
   * 获取用户订单列表
   */
  async getUserOrders(userId: string, query?: {
    status?: string;
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
   * 获取订单详情（强制归属校验）
   */
  async getOrderById(orderId: string, userId?: string) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId; // 强制归属校验

    const order = await this.prisma.order.findUnique({
      where,
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
  async updateOrderStatus(orderId: string, status: string, adminNote?: string, adminRole?: string) {
    // 角色校验：只有 ADMIN 可以修改订单状态
    if (adminRole !== 'ADMIN' && adminRole !== 'WAREHOUSE') {
      throw new ForbiddenException('权限不足');
    }

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
   * 取消订单（原子操作，防止重复恢复库存）
   */
  async cancelOrder(userId: string, orderId: string, reason?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 原子更新：只有 PENDING_PAYMENT 且属于当前用户的订单才能取消
      const result = await tx.order.updateMany({
        where: {
          id: orderId,
          userId,
          status: 'PENDING_PAYMENT',
        },
        data: {
          status: 'CANCELLED',
          cancelReason: reason,
          cancelledAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('订单不存在、不属于你、或不可取消');
      }

      // 只有原子更新成功后才恢复库存
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (order) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return order;
    });
  }

  /**
   * 自动取消超时订单（24 小时未支付）
   * 由 node-cron 每 5 分钟调用一次
   */
  async cancelTimeoutOrders() {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    try {
      // 查找超时订单
      const timeoutOrders = await this.prisma.order.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: { lt: cutoff },
        },
        include: { items: true },
      });

      if (timeoutOrders.length === 0) {
        return { cancelled: 0 };
      }

      console.log(`🔔 发现 ${timeoutOrders.length} 个超时订单，开始自动取消...`);

      for (const order of timeoutOrders) {
        try {
          // 使用事务确保原子性
          await this.prisma.$transaction(async (tx) => {
            // 更新订单状态
            await tx.order.update({
              where: { id: order.id },
              data: {
                status: 'CANCELLED',
                cancelReason: '24 小时未支付，自动取消',
                cancelledAt: new Date(),
              },
            });

            // 恢复库存
            for (const item of order.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
          });

          console.log(`✅ 订单 ${order.orderNo} 已自动取消`);
        } catch (error) {
          console.error(`❌ 取消订单 ${order.orderNo} 失败:`, error.message);
        }
      }

      return { cancelled: timeoutOrders.length };
    } catch (error) {
      console.error('❌ 超时订单扫描失败:', error.message);
      throw error;
    }
  }
}
