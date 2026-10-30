import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * GET /api/v1/reviews/product/:productId
   * 获取商品评价列表
   */
  @Get('product/:productId')
  async getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getProductReviews(productId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * POST /api/v1/reviews
   * 创建评价（需要登录）
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createReview(
    @Req() req: ExpressRequest & { user: any },
    @Body() body: {
      productId: string;
      orderId: string;
      rating: number;
      content: string;
      images?: string[];
    },
  ) {
    return this.reviewsService.createReview(req.user.id, body);
  }

  /**
   * POST /api/v1/reviews/:id/reply
   * 管理员回复评价
   */
  @Post(':id/reply')
  @UseGuards(AuthGuard('jwt'))
  async adminReplyReview(
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    return this.reviewsService.adminReplyReview(id, body.reply);
  }

  /**
   * GET /api/v1/reviews
   * 获取所有评价（管理员）
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getAllReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
  ) {
    return this.reviewsService.getAllReviews({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      productId,
    });
  }
}
