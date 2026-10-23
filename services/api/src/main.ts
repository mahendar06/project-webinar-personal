import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { Logger } from './common/logger';
import { runMigrationsOnStartup } from './database/run-migrations';
import * as os from 'os';

function detectLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

/** Known insecure placeholder values that must never ship to production. */
const INSECURE_DEFAULTS = new Set([
  '',
  'your-secret-key-change-in-production',
  'dev-secret-change-me',
  'devkey-local-secret-change-in-production-00',
  'devkey',
  'minioadmin',
  'change-me',
  'secret',
]);

/**
 * Validates that production secrets are not placeholder values.
 * Throws a fatal error that prevents startup if any are found.
 */
function validateProductionSecrets(configService: ConfigService, logger: Logger): void {
  const isProduction = configService.get('NODE_ENV') === 'production';
  if (!isProduction) return;

  const checks: Array<{ key: string; label: string }> = [
    { key: 'JWT_SECRET',          label: 'JWT secret' },
    { key: 'LIVEKIT_API_SECRET',  label: 'LiveKit API secret' },
    { key: 'S3_SECRET_KEY',       label: 'S3/MinIO secret key' },
  ];

  const failures: string[] = [];
  for (const { key, label } of checks) {
    const value = configService.get<string>(key, '');
    if (INSECURE_DEFAULTS.has(value)) {
      failures.push(`  • ${label} (${key}) is using a placeholder/default value`);
    }
  }

  // SMTP required in production — magic-link auth is broken without it
  const smtpHost = configService.get<string>('SMTP_HOST', '');
  if (!smtpHost) {
    failures.push('  • SMTP_HOST is not configured — magic-link auth will not work in production');
  }

  if (failures.length > 0) {
    logger.error('', 'Bootstrap');
    logger.error('╔══════════════════════════════════════════════════════╗', 'Bootstrap');
    logger.error('║  FATAL: Insecure production configuration detected   ║', 'Bootstrap');
    logger.error('║  The following must be set to secure values:         ║', 'Bootstrap');
    failures.forEach(f => logger.error(f, 'Bootstrap'));
    logger.error('╚══════════════════════════════════════════════════════╝', 'Bootstrap');
    process.exit(1);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new Logger(),
  });

  const configService = app.get(ConfigService);
  const port = configService.get('API_PORT', 3000);
  const logger = new Logger();

  // Run SQL migrations before accepting traffic.
  // Uses a dollar-quote-aware parser so PL/pgSQL functions are handled correctly.
  const databaseUrl = configService.get<string>('DATABASE_URL', '');
  if (databaseUrl) {
    await runMigrationsOnStartup(databaseUrl);
  }

  // Validate production secrets BEFORE opening any port.
  validateProductionSecrets(configService, logger);

  // Enable WebSocket adapter (ws — matches the client's native WebSocket)
  app.useWebSocketAdapter(new WsAdapter(app));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Fix CORS: reflect origin only in development.
  // In production, restrict to the configured PUBLIC_APP_URL to prevent CSRF.
  const isProduction = configService.get('NODE_ENV') === 'production';
  const publicUrl = configService.get<string>('PUBLIC_APP_URL', '');
  app.enableCors({
    origin: isProduction ? (publicUrl || false) : true,
    credentials: true,
  });

  await app.listen(port);

  const lanIp = detectLanIp();
  const clientPort = 5173;

  logger.log('', 'Bootstrap');
  logger.log('╔══════════════════════════════════════════════════╗', 'Bootstrap');
  logger.log('║  Vedika Webinar Platform - API Server            ║', 'Bootstrap');
  logger.log(`║  API:     http://${lanIp}:${port}                 `, 'Bootstrap');
  logger.log(`║  Client:  http://${lanIp}:${clientPort}               `, 'Bootstrap');
  logger.log(`║  Signal:  ws://${lanIp}:${port}/signal            `, 'Bootstrap');
  logger.log(`║  Share:   http://${lanIp}:${clientPort}/w/{slug}     `, 'Bootstrap');
  logger.log('╚══════════════════════════════════════════════════╝', 'Bootstrap');
}

bootstrap();
