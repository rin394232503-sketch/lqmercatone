import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SmsService } from '../sms/sms.service';


@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
    private smsService: SmsService,
  ) {}

  /**
   * 买家登录（手机号 + 验证码）
   * 必须先通过验证码校验才能登录
   */
  async loginWithPhone(phone: string, code: string) {
    // 验证短信验证码
    await this.smsService.verifyCode(phone, code);

    // 查找或创建用户
    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // 自动注册新用户
      user = await this.prisma.user.create({
        data: {
          phone,
          role: 'BUYER',
          preferredLang: 'it',
        },
      });
    }

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        preferredLang: user.preferredLang,
      },
      ...tokens,
    };
  }

  /**
   * 管理员登录（用户名 + 密码）- 带限流保护
   */
  async loginWithPassword(username: string, password: string) {
    // 限流检查：5 次失败/15 分钟
    const rateLimitKey = `login_attempts:${username}`;
    const attempts = await this.redis.get(rateLimitKey);

    if (attempts && parseInt(attempts) >= 5) {
      throw new BadRequestException('登录尝试次数过多，请 15 分钟后再试');
    }

    // 查找管理员
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: username },
          { email: username },
        ],
        role: {
          in: ['ADMIN', 'WAREHOUSE'],
        },
      },
    });

    if (!user || !user.passwordHash) {
      // 增加失败计数
      await this.redis.incr(rateLimitKey);
      await this.redis.expire(rateLimitKey, 15 * 60); // 15 分钟
      throw new UnauthorizedException('账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.redis.incr(rateLimitKey);
      await this.redis.expire(rateLimitKey, 15 * 60);
      throw new UnauthorizedException('密码错误');
    }

    // 登录成功，清除限流计数
    await this.redis.del(rateLimitKey);

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        preferredLang: user.preferredLang,
      },
      ...tokens,
    };
  }

  /**
   * 管理员注册（创建管理员账号）
   */
  async registerAdmin(data: {
    phone: string;
    password: string;
    name?: string;
    role: string;
  }) {
    // 检查是否已存在
    const existing = await this.prisma.user.findUnique({
      where: { phone: data.phone },
    });

    if (existing) {
      throw new ConflictException('该手机号已注册');
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(data.password, 12);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        phone: data.phone,
        passwordHash,
        name: data.name,
        role: data.role,
        preferredLang: 'it',
      },
    });

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  /**
   * 刷新 Token - 检查黑名单
   */
  async refreshToken(refreshToken: string) {
    // 检查是否在黑名单中
    const isBlacklisted = await this.redis.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token 已吊销');
    }

    // 验证 token
    const payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    return tokens;
  }

  /**
   * 登出 - 将 Refresh Token 加入黑名单
   */
  async logout(refreshToken: string) {
    // 将 Refresh Token 加入黑名单（TTL 与 Refresh Token 过期时间一致：7 天）
    const ttl = 7 * 24 * 60 * 60;
    await this.redis.set(`blacklist:${refreshToken}`, '1', ttl);

    return { success: true };
  }

  /**
   * 生成 Access Token + Refresh Token
   */
  private async generateTokens(userId: string, role: string) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 15 分钟（秒）
    };
  }

  /**
   * 验证 Token 并获取用户
   */
  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        role: true,
        preferredLang: true,
        avatar: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }
}
