import { Controller, Post, Body, UseGuards, Req, Get, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PhoneLoginDto, PasswordLoginDto, RegisterAdminDto } from './dto/auth.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/phone-login
   * 买家手机号登录（需要短信验证码）
   * Body: { phone: "+39...", code: "123456" }
   */
  @Post('phone-login')
  async phoneLogin(@Body() dto: PhoneLoginDto) {
    return this.authService.loginWithPhone(dto.phone, dto.code);
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
   * POST /api/v1/auth/admin-login
   * 管理员登录（别名，用于前端管理后台）
   */
  @Post('admin-login')
  async adminLogin(@Body() dto: PasswordLoginDto) {
    return this.authService.loginWithPassword(dto.username, dto.password);
  }

  /**
   * POST /api/v1/auth/register-admin
   * 注册管理员账号（仅 ADMIN 角色可调用，强制创建 WAREHOUSE 角色）
   */
  @Post('register-admin')
  @UseGuards(AuthGuard('jwt'))
  async registerAdmin(@Req() req: { user: any }, @Body() dto: RegisterAdminDto) {
    // 角色校验：仅超级管理员可创建子账号
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('仅超级管理员可创建账号');
    }
    // 强制角色为 WAREHOUSE，不允许前端指定 ADMIN
    dto.role = 'WAREHOUSE';
    return this.authService.registerAdmin(dto);
  }

  /**
   * POST /api/v1/auth/refresh
   * 刷新 Token（检查黑名单）
   */
  @Post('refresh')
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  /**
   * POST /api/v1/auth/logout
   * 登出（将 Refresh Token 加入黑名单）
   */
  @Post('logout')
  async logout(@Body() body: { refreshToken: string }) {
    return this.authService.logout(body.refreshToken);
  }

  /**
   * GET /api/v1/auth/me
   * 获取当前用户信息
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: { user: any }) {
    return req.user;
  }
}
