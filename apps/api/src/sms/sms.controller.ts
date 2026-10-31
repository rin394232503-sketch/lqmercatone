import { Controller, Post, Body } from '@nestjs/common';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * POST /api/v1/sms/send-code
   * 发送验证码到手机号
   * Body: { phone: "+393471234567" }
   */
  @Post('send-code')
  async sendCode(@Body() body: { phone: string }) {
    return this.smsService.sendVerificationCode(body.phone);
  }
}
