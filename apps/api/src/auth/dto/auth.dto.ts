import { IsString, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class PhoneLoginDto {
  @IsString()
  phone: string;  // 意大利手机号 +39...
}

export class PasswordLoginDto {
  @IsString()
  username: string;  // 手机号或邮箱

  @IsString()
  password: string;
}

export class RegisterAdminDto {
  @IsString()
  phone: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum([UserRole.ADMIN, UserRole.WAREHOUSE])
  role: UserRole;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
