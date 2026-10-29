import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取商品评价列表
   */
  async getProductReviews(productId: string, query?: { page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { productId },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where: { productId } }),
    ]);

    return {
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 创建评价（只有已完成订单的买家可以评价）
   */
  async createReview(userId: string, data: {
    productId: string;
    orderId: string;
    rating: number;
    content: string;
    images?: string[];
  }) {
    // 1. 验证订单是否属于该用户且已完成
    const order = await this.prisma.order.findFirst({
      where: {
        id: data.orderId,
        userId,
        status: 'COMPLETED',
      },
      include: {
        items: {
          where: { productId: data.productId },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('订单不存在或未完成');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('订单中没有该商品');
    }

    // 2. 检查是否已评价
    const existingReview = await this.prisma.review.findFirst({
      where: {
        orderId: data.orderId,
        productId: data.productId,
      },
    });

    if (existingReview) {
      throw new BadRequestException('该商品已评价');
    }

    // 3. 创建评价
    return this.prisma.review.create({
      data: {
        userId,
        productId: data.productId,
        orderId: data.orderId,
        rating: data.rating,
        content: data.content,
        images: data.images || [],
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * 管理员回复评价
   */
  async adminReplyReview(reviewId: string, reply: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('评价不存在');
    }

    return this.prisma.review.update({
      where: { id: reviewId },
      data: {
        adminReply: reply,
        adminRepliedAt: new Date(),
      },
    });
  }

  /**
   * 获取用户收到的评价（管理员视角）
   */
  async getAllReviews(query?: {
    page?: number;
    limit?: number;
    productId?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.productId) {
      where.productId = query.productId;
    }

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          product: {
            select: {
              id: true,
              nameIt: true,
              nameZh: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
