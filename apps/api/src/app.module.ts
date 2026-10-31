import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SmsModule } from './sms/sms.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { AddressesModule } from './addresses/addresses.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CouponsModule } from './coupons/coupons.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    // 全局配置模块（加载 .env）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 数据库模块
    PrismaModule,

    // Redis 模块（全局）
    RedisModule,

    // 短信模块
    SmsModule,

    // 业务模块
    ProductsModule,
    AuthModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    ReviewsModule,
    CouponsModule,
    StripeModule,
  ],
})
export class AppModule {}
