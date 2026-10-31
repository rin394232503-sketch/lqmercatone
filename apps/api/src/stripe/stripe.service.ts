import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private couponsService: CouponsService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY') || '';
    this.stripe = new Stripe(secretKey);
  }

  /**
   * 创建支付意图（必须校验订单归属）
   */
  async createPaymentIntent(orderId: string, userId: string) {
    // 1. 获取订单并校验归属
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      throw new BadRequestException('订单不存在或不属于当前用户');
    }

    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('订单状态不正确');
    }

    // 2. 创建 Stripe PaymentIntent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: order.totalCent, // 欧分
      currency: 'eur',
      metadata: {
        orderId: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic', // 3DS 2.0
        },
      },
    });

    // 3. 更新订单
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        transactionId: paymentIntent.id,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  /**
   * 处理 Stripe Webhook
   */
  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    // 必须校验：密钥不能为空
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET 未配置，拒绝所有 Webhook');
    }

    // 必须校验签名
    if (!signature) {
      throw new BadRequestException('缺少 stripe-signature 头');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook 签名验证失败: ${err.message}`);
    }

    // 处理不同的事件类型
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;
    }

    return { received: true };
  }

  /**
   * 支付成功处理（幂等 + 金额校验）
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) return;

    // 幂等：只有 PENDING_PAYMENT 状态才能转为已付款
    const result = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'pending',
      },
      data: {
        status: 'PENDING_SHIP',
        paymentStatus: 'paid',
        paidAt: new Date(),
        transactionId: paymentIntent.id,
      },
    });

    if (result.count === 0) {
      // 已被处理过（重复推送），忽略
      return;
    }

    // 校验金额
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (order && paymentIntent.amount_received !== order.totalCent) {
      // 金额不匹配，标记异常
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          adminNote: `⚠️ 金额不匹配: 应收${order.totalCent} 实收${paymentIntent.amount_received}`,
        },
      });
    }

    console.log(`✅ 订单 ${orderId} 支付成功`);
  }

  /**
   * 支付失败处理
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) return;

    console.log(`❌ 订单 ${orderId} 支付失败`);
  }

  /**
   * 支付取消处理
   */
  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const orderId = paymentIntent.metadata.orderId;

    if (!orderId) return;

    // 恢复库存
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (order) {
      for (const item of order.items) {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      // 更新订单状态
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelReason: '支付取消',
          cancelledAt: new Date(),
        },
      });
    }

    console.log(`️ 订单 ${orderId} 支付已取消`);
  }

  /**
   * 获取支付配置（前端用）
   */
  getPublishableKey() {
    return this.configService.get<string>('STRIPE_PUBLISHABLE_KEY');
  }
}
