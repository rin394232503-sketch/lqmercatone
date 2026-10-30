import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';

@Controller('cart')
@UseGuards(AuthGuard('jwt'))
export class CartController {
  constructor(private readonly cartService: CartService) {}

  /**
   * GET /api/v1/cart
   * 获取当前用户的购物车
   */
  @Get()
  async getCart(@Req() req: ExpressRequest & { user: any }) {
    return this.cartService.getCart(req.user.id);
  }

  /**
   * POST /api/v1/cart/items
   * 添加商品到购物车
   */
  @Post('items')
  async addItem(
    @Req() req: ExpressRequest & { user: any },
    @Body() body: {
      productId: string;
      quantity: number;
      color?: string;
      size?: string;
    },
  ) {
    return this.cartService.addItem(req.user.id, body);
  }

  /**
   * PUT /api/v1/cart/items/:id
   * 更新购物车商品数量
   */
  @Put('items/:id')
  async updateQuantity(
    @Req() req: ExpressRequest & { user: any },
    @Param('id') id: string,
    @Body() body: { quantity: number },
  ) {
    return this.cartService.updateQuantity(req.user.id, id, body.quantity);
  }

  /**
   * DELETE /api/v1/cart/items/:id
   * 删除购物车商品
   */
  @Delete('items/:id')
  async removeItem(@Req() req: ExpressRequest & { user: any }, @Param('id') id: string) {
    return this.cartService.removeItem(req.user.id, id);
  }

  /**
   * DELETE /api/v1/cart
   * 清空购物车
   */
  @Delete()
  async clearCart(@Req() req: ExpressRequest & { user: any }) {
    return this.cartService.clearCart(req.user.id);
  }

  /**
   * POST /api/v1/cart/merge
   * 合并购物车（游客→登录用户）
   */
  @Post('merge')
  async mergeCart(
    @Req() req: ExpressRequest & { user: any },
    @Body() body: {
      items: Array<{
        productId: string;
        quantity: number;
        color?: string;
        size?: string;
      }>;
    },
  ) {
    return this.cartService.mergeCart(req.user.id, body.items);
  }
}
