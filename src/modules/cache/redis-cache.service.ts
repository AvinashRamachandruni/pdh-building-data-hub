import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private readonly client?: RedisClientType;
  private connecting?: Promise<boolean>;

  constructor(config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL is not configured; RDF cache is disabled');
      return;
    }
    this.client = createClient({
      url,
      socket: { connectTimeout: 1000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis connection error: ${error.message}`);
    });
  }

  private async ready(): Promise<boolean> {
    if (!this.client) return false;
    if (this.client.isReady) return true;
    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => true)
        .catch((error: Error) => {
          this.logger.warn(`Redis unavailable: ${error.message}`);
          return false;
        })
        .finally(() => {
          this.connecting = undefined;
        });
    }
    return this.connecting;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client || !(await this.ready())) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.warn(`Redis GET failed: ${(error as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (!this.client || !(await this.ready())) return;
    try {
      await this.client.set(key, value, { EX: ttlSeconds });
    } catch (error) {
      this.logger.warn(`Redis SET failed: ${(error as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !(await this.ready())) return;
    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.warn(`Redis DEL failed: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connecting) await this.connecting;
    if (this.client?.isOpen) await this.client.quit();
  }
}
