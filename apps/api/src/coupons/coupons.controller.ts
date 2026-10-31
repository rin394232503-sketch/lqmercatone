import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { AuthGuard } from '@nestjs/passport';


@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  /**
   * GET /api/v1/coupons
   * 获取所有可用优惠券
   */
  @Get()
  async getAvailableCoupons(@Req() req: { user: any }) {
    return this.couponsService.getAvailableCoupons(req.user?.id);
  }

  /**
   * GET /api/v1/coupons/my
   * 获取我已领取的优惠券
   */
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getUserCoupons(@Req() req: { user: any }) {
    return this.couponsService.getUserCoupons(req.user.id);
  }

  /**
   * POST /api/v1/coupons/claim/:couponId
   * 领取优惠券
   */
  @Post('claim/:couponId')
  @UseGuards(AuthGuard('jwt'))
  async claimCoupon(
    @Req() req: { user: any },
    @Param('couponId') couponId: string,
  ) {
    return this.couponsService.claimCoupon(req.user.id, couponId);
  }

  /**
   * POST /api/v1/coupons/use
   * 使用优惠券
   */
  @Post('use')
  @UseGuards(AuthGuard('jwt'))
  async useCoupon(
    @Req() req: { user: any },
    @Body() body: { couponId: string; orderId: string },
  ) {
    return this.couponsService.useCoupon(req.user.id, body.couponId, body.orderId);
  }

  /**
   * POST /api/v1/coupons/:id/refund
   * 退款退回优惠券
   */
  @Post(':id/refund')
  @UseGuards(AuthGuard('jwt'))
  async refundCoupon(@Req() req: { user: any }, @Param('id') id: string) {
    return this.couponsService.refundCoupon(id);
  }

  // ========== 管理员接口 ==========

  /**
   * POST /api/v1/coupons/admin/create
   * 创建优惠券（仅 ADMIN 角色）
   */
  @Post('admin/create')
  @UseGuards(AuthGuard('jwt'))
  async createCoupon(
    @Req() req: { user: any },
    @Body() body: {
      code: string;
      type: string;
      valueCent?: number;
      percentage?: number;
      minOrderCent: number;
      totalLimit?: number;
      perUserLimit?: number;
      newUserOnly?: boolean;
      stackable?: boolean;
      startsAt: string;
      endsAt: string;
    },
  ) {
    // 角色校验：仅管理员可创建优惠券
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('仅管理员可创建优惠券');
    }
    return this.couponsService.createCoupon({
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
    });
  }

  /**
   * GET /api/v1/coupons/admin/all
   * 获取所有优惠券（仅 ADMIN/WAREHOUSE 角色）
   */
  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'))
  async getAllCoupons(
    @Req() req: { user: any },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // 角色校验
    if (req.user.role !== 'ADMIN' && req.user.role !== 'WAREHOUSE') {
      throw new ForbiddenException('权限不足');
    }
    return this.couponsService.getAllCoupons({
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }
}
