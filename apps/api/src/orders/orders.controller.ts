import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import { OrderStatus } from '@prisma/client';

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
    @Request() req: ExpressRequest & { user: any },
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
    @Request() req: ExpressRequest & { user: any },
    @Query('status') status?: OrderStatus,
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
   * 获取订单详情
   */
  @Get(':id')
  async getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }

  /**
   * POST /api/v1/orders/:id/cancel
   * 取消订单
   */
  @Post(':id/cancel')
  async cancelOrder(
    @Request() req: ExpressRequest & { user: any },
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return this.ordersService.cancelOrder(req.user.id, id, body?.reason);
  }
}
