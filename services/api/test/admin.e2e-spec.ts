import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from '../src/app.module';
import { AdminService } from '../src/admin/admin.service';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let adminService: AdminService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    adminService = moduleFixture.get<AdminService>(AdminService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should list paginated users, sessions, and recordings', async () => {
    const users = await adminService.listUsers({ page: 1, limit: 10 });
    expect(users).toBeDefined();
    expect(Array.isArray(users.data)).toBe(true);
    expect(users.page).toBe(1);

    const sessions = await adminService.listSessions({ page: 1, limit: 10 });
    expect(sessions).toBeDefined();
    expect(Array.isArray(sessions.data)).toBe(true);

    const recordings = await adminService.listRecordings({ page: 1, limit: 10 });
    expect(recordings).toBeDefined();
    expect(Array.isArray(recordings.data)).toBe(true);

    const failedJobs = await adminService.getFailedJobs();
    expect(Array.isArray(failedJobs)).toBe(true);
  });
});
