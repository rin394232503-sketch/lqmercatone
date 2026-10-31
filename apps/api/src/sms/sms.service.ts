import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SmsService {
  private twilioClient: Twilio | null = null;
  private readonly logger = new Logger('SmsService');
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    private redis: RedisService,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      try {
        this.twilioClient = new Twilio(accountSid, authToken);
        this.isEnabled = true;
        this.logger.log('✅ Twilio SMS 服务已初始化');
      } catch (err) {
        this.logger.warn(`⚠️ Twilio 初始化失败: ${err.message}`);
      }
    } else {
      this.logger.warn('⚠️ Twilio 未配置（TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN），短信验证码功能不可用');
    }
  }

  /**
   * 发送验证码
   * @returns 验证码（仅在开发模式/无 Twilio 时返回，用于调试）
   */
  async sendVerificationCode(phone: string): Promise<{ debugCode?: string }> {
    if (!phone || !phone.startsWith('+')) {
      throw new BadRequestException('手机号格式错误，需包含国际区号（如 +39...）');
    }

    // 生成 6 位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储到 Redis，5 分钟过期
    await this.redis.set(`sms:verify:${phone}`, code, 300);

    // 记录发送次数（防刷），每小时最多 5 次
    const rateKey = `sms:rate:${phone}`;
    const rate = await this.redis.incr(rateKey);
    if (rate === 1) {
      await this.redis.expire(rateKey, 3600);
    }
    if (rate > 5) {
      throw new BadRequestException('发送过于频繁，请 1 小时后再试');
    }

    if (this.isEnabled && this.twilioClient) {
      const fromNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');
      if (!fromNumber) {
        throw new BadRequestException('Twilio 发送号码未配置');
      }

      try {
        await this.twilioClient.messages.create({
          body: `L&Q Mercatone: il tuo codice di verifica è ${code}. Valido per 5 minuti.`,
          from: fromNumber,
          to: phone,
        });
        this.logger.log(`📱 验证码已发送到 ${phone}`);
        return {}; // 不返回验证码
      } catch (err) {
        this.logger.error(`❌ 短信发送失败: ${err.message}`);
        throw new BadRequestException('短信发送失败，请稍后重试');
      }
    } else {
      // 开发模式：返回验证码用于调试
      this.logger.warn(`⚠️ [DEV] 验证码 ${code} 发送到 ${phone}（Twilio 未配置）`);
      return { debugCode: code };
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(phone: string, code: string): Promise<boolean> {
    if (!phone || !code) {
      throw new BadRequestException('手机号和验证码不能为空');
    }

    const storedCode = await this.redis.get(`sms:verify:${phone}`);

    if (!storedCode) {
      throw new BadRequestException('验证码已过期，请重新获取');
    }

    if (storedCode !== code) {
      // 记录失败次数
      const failKey = `sms:fail:${phone}`;
      const fails = await this.redis.incr(failKey);
      if (fails === 1) {
        await this.redis.expire(failKey, 900); // 15 分钟
      }
      if (fails >= 5) {
        throw new BadRequestException('验证码错误次数过多，请 15 分钟后再试');
      }
      throw new BadRequestException('验证码错误');
    }

    // 验证成功，清除验证码和失败计数
    await this.redis.del(`sms:verify:${phone}`);
    await this.redis.del(`sms:fail:${phone}`);

    return true;
  }

  /**
   * 检查 Twilio 是否可用
   */
  isTwilioEnabled(): boolean {
    return this.isEnabled;
  }
}
