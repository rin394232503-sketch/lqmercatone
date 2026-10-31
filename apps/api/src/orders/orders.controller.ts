import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';


@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /api/v1/orders
   * 创建订单
   */
  @Post()
  async createOrder(
    @Req() req: { user: any },
    @Body() body: {
      addressId: string;
      paymentMethod: string;
      buyerNote?: string;
      isPickup?: boolean;
      shippingRegion?: string;
    },
  ) {
    return this.ordersService.createOrder(req.user.id, body);
  }

  /**
   * GET /api/v1/orders
   * 获取当前用户的订单列表
   */
  @Get()
  async getUserOrders(
    @Req() req: { user: any },
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ordersService.getUserOrders(req.user.id, {
      status,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  /**
   * GET /api/v1/orders/:id
   * 获取订单详情（强制归属校验）
   */
  @Get(':id')
  async getOrder(@Req() req: { user: any }, @Param('id') id: string) {
    // 管理员可以查看任何订单
    if (req.user.role === 'ADMIN' || req.user.role === 'WAREHOUSE') {
      return this.ordersService.getOrderById(id);
    }
    // 买家只能查看自己的订单
    return this.ordersService.getOrderById(id, req.user.id);
  }

  /**
   * POST /api/v1/orders/:id/cancel
   * 取消订单
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Req() req: { user: any },
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.ordersService.cancelOrder(req.user.id, id, body?.reason);
  }
}
