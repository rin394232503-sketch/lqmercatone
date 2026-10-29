import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponType } from '@prisma/client';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有可用优惠券（买家）
   */
  async getAvailableCoupons(userId?: string) {
    const now = new Date();

    const coupons = await this.prisma.coupon.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: {
        userCoupons: {
          where: { userId },
          select: { id: true, usedAt: true },
        },
      },
    });

    return coupons.map(coupon => {
      const claimed = coupon.userCoupons.length;
      const totalLimit = coupon.totalLimit || 0;
      const remaining = totalLimit > 0 ? totalLimit - claimed : -1; // -1 表示无限

      return {
        ...coupon,
        claimed,
        remaining,
        value: coupon.valueCent / 100,
        minOrder: coupon.minOrderCent / 100,
        userCouponId: coupon.userCoupons[0]?.id || null,
        isUsed: coupon.userCoupons[0]?.usedAt !== null,
        userCoupons: undefined,
      };
    });
  }

  /**
   * 领取优惠券
   */
  async claimCoupon(userId: string, couponId: string) {
    // 1. 检查优惠券
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        userCoupons: {
          where: { userId },
        },
        _count: {
          select: { userCoupons: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('优惠券不存在');
    }

    // 2. 检查是否已领取
    if (coupon.userCoupons.length > 0) {
      throw new BadRequestException('已领取该优惠券');
    }

    // 3. 检查总领取限制
    if (coupon.totalLimit > 0 && coupon._count.userCoupons >= coupon.totalLimit) {
      throw new BadRequestException('优惠券已领完');
    }

    // 4. 检查每人领取限制
    const userClaimCount = coupon.userCoupons.length;
    if (userClaimCount >= coupon.perUserLimit) {
      throw new BadRequestException('已达到领取上限');
    }

    // 5. 检查新用户限制
    if (coupon.newUserOnly) {
      const userOrders = await this.prisma.order.count({ where: { userId } });
      if (userOrders > 0) {
        throw new BadRequestException('仅限新用户领取');
      }
    }

    // 6. 创建用户优惠券
    const userCoupon = await this.prisma.userCoupon.create({
      data: {
        userId,
        couponId,
      },
    });

    // 7. 记录日志
    await this.prisma.couponUsageLog.create({
      data: {
        couponId,
        userId,
        action: 'claim',
      },
    });

    return userCoupon;
  }

  /**
   * 获取用户已领取的优惠券
   */
  async getUserCoupons(userId: string) {
    const userCoupons = await this.prisma.userCoupon.findMany({
      where: { userId },
      include: {
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return userCoupons.map(uc => ({
      ...uc,
      coupon: {
        ...uc.coupon,
        value: uc.coupon.valueCent / 100,
        minOrder: uc.coupon.minOrderCent / 100,
      },
    }));
  }

  /**
   * 使用优惠券（创建订单时调用）
   */
  async useCoupon(userId: string, couponId: string, orderId: string) {
    const userCoupon = await this.prisma.userCoupon.findFirst({
      where: {
        id: couponId,
        userId,
        usedAt: null, // 未使用
      },
      include: {
        coupon: true,
      },
    });

    if (!userCoupon) {
      throw new NotFoundException('优惠券不存在或已使用');
    }

    const coupon = userCoupon.coupon;

    // 检查有效期
    const now = new Date();
    if (now < coupon.startsAt || now > coupon.endsAt) {
      throw new BadRequestException('优惠券已过期');
    }

    // 标记为已使用
    const updated = await this.prisma.userCoupon.update({
      where: { id: userCoupon.id },
      data: {
        usedAt: now,
        usedOrderId: orderId,
      },
    });

    // 记录日志
    await this.prisma.couponUsageLog.create({
      data: {
        couponId: coupon.id,
        userId,
        action: 'use',
        orderId,
      },
    });

    return updated;
  }

  /**
   * 退款退回优惠券
   */
  async refundCoupon(userCouponId: string) {
    const userCoupon = await this.prisma.userCoupon.findUnique({
      where: { id: userCouponId },
    });

    if (!userCoupon || !userCoupon.usedAt) {
      throw new NotFoundException('优惠券不存在或未使用');
    }

    // 退回优惠券
    const updated = await this.prisma.userCoupon.update({
      where: { id: userCouponId },
      data: {
        usedAt: null,
        usedOrderId: null,
        refundedAt: new Date(),
      },
    });

    // 记录日志
    await this.prisma.couponUsageLog.create({
      data: {
        couponId: userCoupon.couponId,
        userId: userCoupon.userId,
        action: 'refund',
      },
    });

    return updated;
  }

  // ========== 管理员功能 ==========

  /**
   * 创建优惠券（管理员）
   */
  async createCoupon(data: {
    code: string;
    type: CouponType;
    valueCent?: number;
    percentage?: number;
    minOrderCent: number;
    totalLimit?: number;
    perUserLimit?: number;
    newUserOnly?: boolean;
    stackable?: boolean;
    startsAt: Date;
    endsAt: Date;
  }) {
    // 检查代码是否重复
    const existing = await this.prisma.coupon.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new BadRequestException('优惠码已存在');
    }

    return this.prisma.coupon.create({
      data: {
        ...data,
        valueCent: data.valueCent || 0,
        totalLimit: data.totalLimit || 0,
        perUserLimit: data.perUserLimit || 1,
        newUserOnly: data.newUserOnly || false,
        stackable: data.stackable || false,
      },
    });
  }

  /**
   * 获取所有优惠券（管理员）
   */
  async getAllCoupons(query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        skip,
        take: limit,
        include: {
          _count: {
            select: { userCoupons: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count(),
    ]);

    return {
      data: coupons.map(c => ({
        ...c,
        value: c.valueCent / 100,
        minOrder: c.minOrderCent / 100,
        claimed: c._count.userCoupons,
        _count: undefined,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
