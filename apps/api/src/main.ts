import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  // 启动前环境变量校验
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Stripe Webhook 签名验证需要原始 body
  });

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS（生产环境严格白名单）
  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? ['https://lqmercatone.com', 'https://lqmercatone.vercel.app']
    : ['http://localhost:3000', 'https://lqmercatone.com', 'https://lqmercatone.vercel.app'];

  app.enableCors({
    origin: (origin, callback) => {
      // 允许无 origin 的请求（如 curl、移动端 APP）
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('不允许的域名: ' + origin));
      }
    },
    credentials: true,
  });

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(` L&Q Mercatone API 启动成功: http://localhost:${port}`);
  console.log(`📋 API 前缀: /api/v1`);
}

/**
 * 启动前环境变量校验
 * 检查关键环境变量是否已配置
 */
function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'STRIPE_SECRET_KEY',
  ];

  const warnings: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`❌ 缺少必要环境变量: ${key}。请在 .env 或 Render Dashboard 中配置。`);
    }
  }

  // Stripe Webhook Secret 警告（生产环境必须配置）
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        '❌ 生产环境必须配置 STRIPE_WEBHOOK_SECRET。\n' +
        '操作步骤：\n' +
        '1. 登录 Stripe Dashboard → Developers → Webhooks\n' +
        '2. 点击 "Add endpoint"\n' +
        '3. Endpoint URL: https://你的域名/api/v1/payment/webhook\n' +
        '4. 选择事件: payment_intent.succeeded, payment_intent.payment_failed\n' +
        '5. 复制 "Signing secret" (whsec_...) 到环境变量 STRIPE_WEBHOOK_SECRET'
      );
    } else {
      warnings.push(
        '⚠️ STRIPE_WEBHOOK_SECRET 未配置（开发环境）。\n' +
        '  Webhook 签名验证将拒绝所有请求。\n' +
        '  配置方法: Stripe Dashboard → Webhooks → Add endpoint → 获取 Signing secret'
      );
    }
  }

  // Twilio 警告
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    warnings.push(
      '⚠️ Twilio 未配置（TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN）。\n' +
      '  短信验证码功能将不可用，登录时验证码会打印到控制台。\n' +
      '  配置方法: 注册 Twilio → 获取 Account SID + Auth Token + Phone Number'
    );
  }

  // Redis 警告
  if (!process.env.REDIS_URL) {
    warnings.push(
      '⚠️ REDIS_URL 未配置。登录限流、Token 黑名单、分布式锁将降级为内存模式。\n' +
      '  推荐: 注册 Upstash (https://upstash.com) 获取免费 Redis'
    );
  }

  // 输出警告
  for (const w of warnings) {
    logger.warn(w);
  }

  logger.log('✅ 环境变量校验通过');
}

bootstrap();
