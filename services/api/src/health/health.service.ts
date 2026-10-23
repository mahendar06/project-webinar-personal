import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HealthCheck } from '@webinar/shared';
import Redis from 'ioredis';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  /**
   * Singleton Redis client reused across all health check calls.
   * Created once in the constructor to avoid per-request connection churn.
   */
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(redisUrl);
    } catch {
      parsedUrl = new URL('redis://localhost:6379');
    }
    this.redis = new Redis({
      host: parsedUrl.hostname || 'localhost',
      port: parseInt(parsedUrl.port || '6379', 10),
      password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
      tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.connect().catch((err) =>
      this.logger.warn(`HealthService Redis connect failed: ${err.message}`),
    );
  }

  async check(): Promise<HealthCheck> {
    const services: HealthCheck['services'] = {};
    let overallStatus: 'ok' | 'error' = 'ok';

    // Check database — reuse the existing TypeORM DataSource (no new pool created)
    try {
      await this.dataSource.query('SELECT 1');
      services.database = 'ok';
    } catch (error) {
      this.logger.error('Database health check failed', error);
      services.database = 'error';
      overallStatus = 'error';
    }

    // Check Redis — reuse the singleton client
    try {
      await this.redis.ping();
      services.redis = 'ok';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      services.redis = 'error';
      overallStatus = 'error';
    }

    // GAP-18: Check LiveKit SFU availability
    // Non-critical: LiveKit unavailable should not mark the API as fully down.
    try {
      const livekitUrl = this.configService.get<string>('LIVEKIT_URL', 'ws://localhost:7880');
      const httpUrl = livekitUrl.replace(/^ws(s?):\/\//, 'http$1://');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${httpUrl}/rtc/validate`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      // LiveKit returns various codes depending on version; any sub-500 means server is alive.
      services.livekit = (res && res.status < 500) ? 'ok' : 'error';
    } catch {
      services.livekit = 'error';
      this.logger.warn('LiveKit health check failed (non-critical)');
    }

    // GAP-18: Check MinIO object storage availability
    try {
      const minioUrl = this.configService.get<string>('MINIO_ENDPOINT', 'http://localhost:9000');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${minioUrl}/minio/health/live`, { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);
      services.storage = (res && res.status < 500) ? 'ok' : 'error';
    } catch {
      services.storage = 'error';
      this.logger.warn('MinIO health check failed (non-critical)');
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services,
    };
  }
}
