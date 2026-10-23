import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../src/app.module';
import { SessionsService } from '../src/sessions/sessions.service';
import { AuthService } from '../src/auth/auth.service';
import { SessionStatus } from '@webinar/shared';

describe('Sessions (e2e)', () => {
  let app: INestApplication;
  let sessionsService: SessionsService;
  let authService: AuthService;
  let instructorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    sessionsService = moduleFixture.get<SessionsService>(SessionsService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Create instructor via magic link flow
    const email = `instructor-${Date.now()}@example.com`;
    const { token } = await authService.requestMagicLink(email);
    const { user } = await authService.verifyMagicLinkToken(token);
    instructorId = user.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create, start, and end a session lifecycle', async () => {
    // 1. Create session
    const session = await sessionsService.createSession(instructorId, {
      title: 'Full Lifecycle Webinar',
      description: 'End to end session test',
      scheduledAt: new Date(Date.now() + 3600000),
      maxAttendees: 50,
    });

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.status).toBe(SessionStatus.SCHEDULED);
    expect(session.liveKitRoomName).toBeDefined();
    expect(session.liveKitRoomName).not.toBe('pending');
    expect(session.slug).toBeDefined();

    // 2. Start session
    const started = await sessionsService.startSession(session.id, instructorId);
    expect(started.status).toBe(SessionStatus.LIVE);
    expect(started.startedAt).toBeDefined();

    // 3. End session
    const ended = await sessionsService.endSession(session.id, instructorId);
    expect(ended.status).toBe(SessionStatus.ENDED);
    expect(ended.endedAt).toBeDefined();
  });
});
