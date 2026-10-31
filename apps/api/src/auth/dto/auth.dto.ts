import { IsString, IsOptional, IsEnum } from 'class-validator';


export class PhoneLoginDto {
  @IsString()
  phone: string;  // 意大利手机号 +39...

  @IsString()
  code: string;   // 短信验证码（6 位数字）
}

export class SendCodeDto {
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

  @IsEnum(['ADMIN', 'WAREHOUSE'])
  role: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
