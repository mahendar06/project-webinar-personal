import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '@webinar/shared';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { RateLimitGuard, RATE_LIMIT_KEY } from '../common/rate-limit.guard';

@Controller('classes')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 10, windowSeconds: 60 })
  async createSession(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSessionDto,
  ) {
    return await this.sessionsService.createSession(user.id, dto);
  }

  @Get(':id')
  async getSession(@Param('id') id: string) {
    return await this.sessionsService.getSession(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async listSessions(@CurrentUser() user: AuthUser) {
    return await this.sessionsService.listInstructorSessions(user.id);
  }

  @Patch(':id')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 20, windowSeconds: 60 })
  async updateSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSessionDto,
  ) {
    return await this.sessionsService.updateSession(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 5, windowSeconds: 60 })
  async deleteSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.sessionsService.deleteSession(id, user.id);
  }

  @Post(':id/start')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 5, windowSeconds: 60 })
  async startSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.sessionsService.startSession(id, user.id);
  }

  @Post(':id/end')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 5, windowSeconds: 60 })
  async endSession(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return await this.sessionsService.endSession(id, user.id);
  }
}
