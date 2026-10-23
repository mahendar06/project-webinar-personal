import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let authService: AuthService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should generate magic link token and verify it to issue JWT', async () => {
    const email = `test-auth-${Date.now()}@example.com`;

    // 1. Request magic link — returns a short-lived token
    const requestResult = await authService.requestMagicLink(email);
    expect(requestResult).toBeDefined();
    expect(requestResult.token).toBeDefined();
    expect(typeof requestResult.token).toBe('string');

    // 2. Verify the magic link token — should create user + return access token
    const verifyResult = await authService.verifyMagicLinkToken(requestResult.token);
    expect(verifyResult).toBeDefined();
    expect(verifyResult.accessToken).toBeDefined();
    expect(verifyResult.user).toBeDefined();
    expect(verifyResult.user.email).toBe(email);
    expect(verifyResult.user.id).toBeDefined();

    // 3. Validate the created user exists
    const user = await authService.validateUser(verifyResult.user.id);
    expect(user).toBeDefined();
    expect(user.email).toBe(email);
  });

  it('should reject invalid magic link tokens', async () => {
    await expect(
      authService.verifyMagicLinkToken('invalid-token-string'),
    ).rejects.toThrow();
  });
});
