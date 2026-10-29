import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS（允许前端跨域）
  app.enableCors({
    origin: [
      'http://localhost:3000',      // Next.js 开发
      'https://lqmercatone.com',    // 生产域名
      'https://lqmercatone.vercel.app',
    ],
    credentials: true,
  });

  // 全局前缀
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(` L&Q Mercatone API 启动成功: http://localhost:${port}`);
  console.log(`📋 API 前缀: /api/v1`);
}

bootstrap();
