import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@webinar/shared';
import { UserFilterDto, SessionFilterDto, RecordingFilterDto } from './dto/admin-query.dto';

/**
 * Admin API — all routes require JWT + INSTRUCTOR role.
 * INSTRUCTOR is the admin/organizer role in this system.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.INSTRUCTOR)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/users — list all users with optional role filter */
  @Get('users')
  async listUsers(@Query() filter: UserFilterDto) {
    const result = await this.adminService.listUsers(filter);
    return { success: true, ...result };
  }

  /** GET /admin/sessions — list all sessions with optional status/date filters */
  @Get('sessions')
  async listSessions(@Query() filter: SessionFilterDto) {
    const result = await this.adminService.listSessions(filter);
    return { success: true, ...result };
  }

  /** GET /admin/sessions/:id — session detail with instructor info */
  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    const session = await this.adminService.getSessionDetail(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return { success: true, data: session };
  }

  /** GET /admin/sessions/:id/attendance — per-participant join/leave records */
  @Get('sessions/:id/attendance')
  async getAttendance(@Param('id') id: string) {
    const attendance = await this.adminService.getSessionAttendance(id);
    return { success: true, data: attendance };
  }

  /** GET /admin/recordings — list all recordings with optional status filter */
  @Get('recordings')
  async listRecordings(@Query() filter: RecordingFilterDto) {
    const result = await this.adminService.listRecordings(filter);
    return { success: true, ...result };
  }

  /** GET /admin/jobs/failed — view failed recording jobs from BullMQ DLQ */
  @Get('jobs/failed')
  async getFailedJobs() {
    const jobs = await this.adminService.getFailedJobs();
    return { success: true, data: jobs };
  }
}
