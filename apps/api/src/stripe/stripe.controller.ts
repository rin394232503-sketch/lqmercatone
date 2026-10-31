import { Controller, Get, Post, Body, Headers, Req, UseGuards } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('payment')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * GET /api/v1/payment/config
   * 获取 Stripe 配置（公钥）
   */
  @Get('config')
  getConfig() {
    return {
      publishableKey: this.stripeService.getPublishableKey(),
      currency: 'EUR',
    };
  }

  /**
   * POST /api/v1/payment/create-intent
   * 创建支付意图（必须登录 + 订单属于当前用户）
   */
  @Post('create-intent')
  @UseGuards(AuthGuard('jwt'))
  async createPaymentIntent(
    @Req() req: { user: any },
    @Body() body: { orderId: string },
  ) {
    return this.stripeService.createPaymentIntent(body.orderId, req.user.id);
  }

  /**
   * POST /api/v1/payment/webhook
   * Stripe Webhook 回调（不需要 JWT，但必须校验签名）
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any,
  ) {
    const rawBody = req.rawBody || Buffer.from('');
    return this.stripeService.handleWebhook(rawBody, signature);
  }
}
