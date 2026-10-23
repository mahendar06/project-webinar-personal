import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  SetMetadata,
} from '@nestjs/common';
import type { Response } from 'express';
import { RecordingService } from './recording.service';
import { ApiResponse, RecordingResponse, AuthUser } from '@webinar/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RateLimitGuard, RATE_LIMIT_KEY } from '../common/rate-limit.guard';

@Controller('classes')
export class RecordingController {
  constructor(private readonly recordingService: RecordingService) {}

  /** Start recording — host only (JWT required) */
  @Post(':id/recording/start')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 5, windowSeconds: 60 })
  @HttpCode(HttpStatus.OK)
  async startRecording(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<RecordingResponse>> {
    const recording = await this.recordingService.startRecording(sessionId, user.id);
    return { success: true, data: recording };
  }

  /** Stop recording — host only (JWT required) */
  @Post(':id/recording/stop')
  @UseGuards(RateLimitGuard, JwtAuthGuard)
  @SetMetadata(RATE_LIMIT_KEY, { limit: 5, windowSeconds: 60 })
  @HttpCode(HttpStatus.OK)
  async stopRecording(
    @Param('id') sessionId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<RecordingResponse>> {
    const recording = await this.recordingService.stopRecording(sessionId, user.id);
    return { success: true, data: recording };
  }

  /**
   * Get current recording status — no auth required so attendees can
   * display a "REC" indicator without needing a JWT.
   */
  @Get(':id/recording')
  async getRecording(
    @Param('id') sessionId: string,
  ): Promise<ApiResponse<RecordingResponse>> {
    const recording = await this.recordingService.getRecording(sessionId);
    return { success: true, data: recording };
  }
}

@Controller('recordings')
export class RecordingDownloadController {
  constructor(private readonly recordingService: RecordingService) {}

  /**
   * Download a completed recording via a MinIO presigned URL.
   * Requires JWT auth — only the session instructor may download.
   */
  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  async downloadRecording(
    @Param('id') recordingId: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.recordingService.getDownloadUrl(recordingId, user.id);
    res.redirect(302, url);
  }
}
