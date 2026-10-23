import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, ForbiddenException } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../src/app.module';
import { RecordingService } from '../src/recording/recording.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { AuthService } from '../src/auth/auth.service';

describe('Recording (e2e)', () => {
  let app: INestApplication;
  let recordingService: RecordingService;
  let sessionsService: SessionsService;
  let authService: AuthService;
  let instructorId: string;
  let otherUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    recordingService = moduleFixture.get<RecordingService>(RecordingService);
    sessionsService = moduleFixture.get<SessionsService>(SessionsService);
    authService = moduleFixture.get<AuthService>(AuthService);

    // Create instructor via magic link flow
    const instructorEmail = `rec-host-${Date.now()}@example.com`;
    const { token: instrToken } = await authService.requestMagicLink(instructorEmail);
    const { user: instructor } = await authService.verifyMagicLinkToken(instrToken);
    instructorId = instructor.id;

    // Create a separate non-instructor user via magic link flow
    const otherEmail = `other-${Date.now()}@example.com`;
    const { token: otherToken } = await authService.requestMagicLink(otherEmail);
    const { user: otherUser } = await authService.verifyMagicLinkToken(otherToken);
    otherUserId = otherUser.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should reject non-instructor start/stop recording requests', async () => {
    const session = await sessionsService.createSession(instructorId, {
      title: 'Recording Auth Check',
      scheduledAt: new Date(),
    });

    await sessionsService.startSession(session.id, instructorId);

    await expect(
      recordingService.startRecording(session.id, otherUserId),
    ).rejects.toThrow(ForbiddenException);
  });
});
