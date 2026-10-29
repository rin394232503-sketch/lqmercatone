import { Controller, Get, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request } from 'express';

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
   * 创建支付意图
   */
  @Post('create-intent')
  async createPaymentIntent(@Body() body: { orderId: string }) {
    return this.stripeService.createPaymentIntent(body.orderId);
  }

  /**
   * POST /api/v1/payment/webhook
   * Stripe Webhook 回调
   * 注意：需要配置 raw body
   */
  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody || Buffer.from('');
    return this.stripeService.handleWebhook(rawBody, signature);
  }
}
