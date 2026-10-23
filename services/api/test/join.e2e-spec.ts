import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../src/app.module';
import { JoinService } from '../src/join/join.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { AuthService } from '../src/auth/auth.service';
import { InvitesService } from '../src/invites/invites.service';

describe('Join (e2e)', () => {
  let app: INestApplication;
  let joinService: JoinService;
  let sessionsService: SessionsService;
  let authService: AuthService;
  let invitesService: InvitesService;
  let instructorId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    joinService = moduleFixture.get<JoinService>(JoinService);
    sessionsService = moduleFixture.get<SessionsService>(SessionsService);
    authService = moduleFixture.get<AuthService>(AuthService);
    invitesService = moduleFixture.get<InvitesService>(InvitesService);

    // Create instructor via magic link flow
    const email = `join-host-${Date.now()}@example.com`;
    const { token } = await authService.requestMagicLink(email);
    const { user } = await authService.verifyMagicLinkToken(token);
    instructorId = user.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should allow attendee to join a live session via invite token', async () => {
    // 1. Create and start a session
    const session = await sessionsService.createSession(instructorId, {
      title: 'Join Flow Test Session',
      scheduledAt: new Date(),
    });

    await sessionsService.startSession(session.id, instructorId);

    // 2. Create invite token
    const invite = await invitesService.createInvite(session.id);

    // 3. Join as attendee using the generated invite token
    const joinResult = await joinService.requestJoin(
      invite.token,
      'Jane Doe',
    );

    expect(joinResult).toBeDefined();
    expect(joinResult.signalToken).toBeDefined();
    expect(joinResult.roomName).toBeDefined();
    expect(joinResult.sessionTitle).toBe('Join Flow Test Session');
  });
});
