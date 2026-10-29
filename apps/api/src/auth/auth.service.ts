import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 买家登录（手机号 + 验证码）
   * 注意：验证码验证由 Twilio 处理，这里假设验证码已通过
   */
  async loginWithPhone(phone: string) {
    // 查找或创建用户
    let user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // 自动注册新用户
      user = await this.prisma.user.create({
        data: {
          phone,
          role: UserRole.BUYER,
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
   * 管理员登录（用户名 + 密码）
   */
  async loginWithPassword(username: string, password: string) {
    // 查找管理员
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: username },
          { email: username },
        ],
        role: {
          in: [UserRole.ADMIN, UserRole.WAREHOUSE],
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('账号不存在');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
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
   * 管理员注册（创建管理员账号）
   */
  async registerAdmin(data: {
    phone: string;
    password: string;
    name?: string;
    role: UserRole;
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
   * 刷新 Token
   */
  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const tokens = await this.generateTokens(user.id, user.role);
    return tokens;
  }

  /**
   * 生成 Access Token + Refresh Token
   */
  private async generateTokens(userId: string, role: UserRole) {
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
