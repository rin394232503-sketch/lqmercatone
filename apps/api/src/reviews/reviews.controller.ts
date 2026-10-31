import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AuthGuard } from '@nestjs/passport';

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
    @Req() req: { user: any },
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
   * 管理员回复评价（仅 ADMIN/WAREHOUSE）
   */
  @Post(':id/reply')
  @UseGuards(AuthGuard('jwt'))
  async adminReplyReview(
    @Req() req: { user: any },
    @Param('id') id: string,
    @Body() body: { reply: string },
  ) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'WAREHOUSE') {
      throw new ForbiddenException('仅管理员可回复评价');
    }
    return this.reviewsService.adminReplyReview(id, body.reply);
  }

  /**
   * GET /api/v1/reviews
   * 获取所有评价（仅 ADMIN/WAREHOUSE）
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  async getAllReviews(
    @Req() req: { user: any },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
  ) {
    if (req.user.role !== 'ADMIN' && req.user.role !== 'WAREHOUSE') {
      throw new ForbiddenException('权限不足');
    }
    return this.reviewsService.getAllReviews({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      productId,
    });
  }
}
