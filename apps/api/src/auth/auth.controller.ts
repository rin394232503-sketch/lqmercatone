import { Controller, Post, Body, UseGuards, Request, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PhoneLoginDto, PasswordLoginDto, RegisterAdminDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/phone-login
   * 买家手机号登录（验证码由 Twilio 处理）
   */
  @Post('phone-login')
  async phoneLogin(@Body() dto: PhoneLoginDto) {
    return this.authService.loginWithPhone(dto.phone);
  }

  /**
   * POST /api/v1/auth/login
   * 管理员密码登录
   */
  @Post('login')
  async passwordLogin(@Body() dto: PasswordLoginDto) {
    return this.authService.loginWithPassword(dto.username, dto.password);
  }

  /**
   * POST /api/v1/auth/register-admin
   * 注册管理员账号（需要已有管理员权限）
   */
  @Post('register-admin')
  @UseGuards(AuthGuard('jwt'))
  async registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.authService.registerAdmin(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   * 刷新 Token
   */
  @Post('refresh')
  @UseGuards(AuthGuard('jwt'))
  async refreshToken(@Request() req: ExpressRequest & { user: any }) {
    return this.authService.refreshToken(req.user.id);
  }

  /**
   * GET /api/v1/auth/me
   * 获取当前用户信息
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Request() req: ExpressRequest & { user: any }) {
    return req.user;
  }
}
