import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 服务 — 含异常降级方案
 *
 * 降级策略：
 * 1. Redis 不可用时，限流功能降级为"不限制"（允许登录，但记录告警日志）
 * 2. Redis 不可用时，Token 黑名单降级为"不吊销"（登出不生效，但服务不崩溃）
 * 3. Redis 不可用时，分布式锁降级为"本地锁"（多实例可能重复执行，但服务不崩溃）
 * 4. 所有 Redis 操作都 try-catch，失败时降级而非抛异常
 *
 * 告警埋点：
 * - Redis 连接断开/恢复时记录日志
 * - 降级操作时记录 WARN 日志
 * - 连续失败超过阈值时触发告警
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private isRedisReady = false;
  private consecutiveFailures = 0;
  private readonly MAX_FAILURES_BEFORE_ALERT = 5;
  private readonly logger = new Logger('RedisService');

  // 本地内存存储（降级时使用）
  private memoryStore = new Map<string, { value: string; expireAt?: number }>();

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('⚠️ REDIS_URL 未配置，所有 Redis 操作将降级为内存模式');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.error(`❌ Redis 连接失败 ${times} 次，停止重试，进入降级模式`);
            this.isRedisReady = false;
            this.emitAlert('Redis 连接失败，进入降级模式');
            return null; // 停止重试
          }
          return Math.min(times * 200, 2000); // 指数退避
        },
        connectTimeout: 5000,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        this.logger.log('✅ Redis 连接成功');
        this.isRedisReady = true;
        this.consecutiveFailures = 0;
      });

      this.redis.on('ready', () => {
        this.isRedisReady = true;
        this.consecutiveFailures = 0;
      });

      this.redis.on('error', (err) => {
        this.consecutiveFailures++;
        this.isRedisReady = false;
        this.logger.error(`❌ Redis 错误 (连续失败 ${this.consecutiveFailures} 次): ${err.message}`);

        if (this.consecutiveFailures >= this.MAX_FAILURES_BEFORE_ALERT) {
          this.emitAlert(`Redis 连续失败 ${this.consecutiveFailures} 次，所有操作降级为内存模式`);
        }
      });

      this.redis.on('close', () => {
        this.isRedisReady = false;
        this.logger.warn('⚠️ Redis 连接关闭，进入降级模式');
      });

      this.redis.on('reconnecting', () => {
        this.logger.log('🔄 Redis 正在重连...');
      });

      // 尝试连接
      this.redis.connect().catch((err) => {
        this.logger.error(`❌ Redis 初始连接失败: ${err.message}`);
        this.isRedisReady = false;
      });
    } catch (err) {
      this.logger.error(`❌ Redis 初始化失败: ${err.message}`);
      this.redis = null;
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  /**
   * 触发告警（可扩展为接入监控平台）
   */
  private emitAlert(message: string) {
    this.logger.error(`🚨 [ALERT] ${message}`);
    // 可扩展：发送告警到监控平台（如 Sentry, DataDog, PagerDuty）
    // fetch('https://monitoring.example.com/alert', { method: 'POST', body: ... });
  }

  /**
   * 清理过期的内存缓存
   */
  private cleanExpiredMemory() {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore.entries()) {
      if (entry.expireAt && entry.expireAt < now) {
        this.memoryStore.delete(key);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    // 优先使用 Redis
    if (this.redis && this.isRedisReady) {
      try {
        return await this.redis.get(key);
      } catch (err) {
        this.handleFailure('get', key, err);
      }
    }

    // 降级：使用内存
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (entry.expireAt && entry.expireAt < Date.now()) {
      this.memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (this.redis && this.isRedisReady) {
      try {
        if (ttl) {
          await this.redis.set(key, value, 'EX', ttl);
        } else {
          await this.redis.set(key, value);
        }
        return;
      } catch (err) {
        this.handleFailure('set', key, err);
      }
    }

    // 降级：使用内存
    this.memoryStore.set(key, {
      value,
      expireAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
  }

  async incr(key: string): Promise<number> {
    if (this.redis && this.isRedisReady) {
      try {
        return await this.redis.incr(key);
      } catch (err) {
        this.handleFailure('incr', key, err);
      }
    }

    // 降级：使用内存
    const entry = this.memoryStore.get(key);
    const currentVal = entry ? parseInt(entry.value) || 0 : 0;
    const newVal = currentVal + 1;
    this.memoryStore.set(key, { value: newVal.toString() });
    return newVal;
  }

  async expire(key: string, seconds: number): Promise<void> {
    if (this.redis && this.isRedisReady) {
      try {
        await this.redis.expire(key, seconds);
        return;
      } catch (err) {
        this.handleFailure('expire', key, err);
      }
    }

    // 降级：更新内存中的过期时间
    const entry = this.memoryStore.get(key);
    if (entry) {
      entry.expireAt = Date.now() + seconds * 1000;
    }
  }

  async del(key: string): Promise<void> {
    if (this.redis && this.isRedisReady) {
      try {
        await this.redis.del(key);
        return;
      } catch (err) {
        this.handleFailure('del', key, err);
      }
    }

    // 降级：从内存中删除
    this.memoryStore.delete(key);
  }

  async setNx(key: string, value: string, ttl?: number): Promise<boolean> {
    if (this.redis && this.isRedisReady) {
      try {
        let result: string | null;
        if (ttl) {
          result = await this.redis.set(key, value, 'EX', ttl, 'NX');
        } else {
          result = await this.redis.set(key, value, 'NX');
        }
        return result === 'OK';
      } catch (err) {
        this.handleFailure('setNx', key, err);
      }
    }

    // 降级：使用内存（单实例场景有效，多实例无法防止重复）
    this.logger.warn(`⚠️ Redis 不可用，分布式锁降级为内存模式（多实例可能重复执行）`);
    const existing = this.memoryStore.get(key);
    if (existing && (!existing.expireAt || existing.expireAt > Date.now())) {
      return false; // key 已存在
    }
    this.memoryStore.set(key, {
      value,
      expireAt: ttl ? Date.now() + ttl * 1000 : undefined,
    });
    return true;
  }

  /**
   * 处理 Redis 操作失败
   */
  private handleFailure(operation: string, key: string, err: any) {
    this.consecutiveFailures++;
    this.isRedisReady = false;
    this.logger.warn(
      `⚠️ Redis ${operation} 失败 (key=${key}): ${err.message}，降级为内存模式`
    );

    if (this.consecutiveFailures >= this.MAX_FAILURES_BEFORE_ALERT) {
      this.emitAlert(`Redis 连续失败 ${this.consecutiveFailures} 次，所有操作降级`);
    }
  }

  /**
   * 检查 Redis 是否可用
   */
  isAvailable(): boolean {
    return this.redis !== null && this.isRedisReady;
  }

  /**
   * 获取当前运行模式
   */
  getMode(): 'redis' | 'memory' {
    return this.isAvailable() ? 'redis' : 'memory';
  }
}
