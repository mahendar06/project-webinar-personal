import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { RecordingResponse, RecordingStatus, AuditAction, SessionStatus } from '@webinar/shared';
import { RecordingEntity } from '../database/entities/recording.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { EgressService } from '../livekit/egress.service';
import { AuditService } from '../database/audit.service';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';

@Injectable()
export class RecordingService {
  private readonly logger = new Logger(RecordingService.name);
  private readonly recordingsRoot: string;
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('recording') private readonly recordingQueue: Queue,
    @InjectRepository(RecordingEntity)
    private readonly recordingRepository: Repository<RecordingEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
    private readonly egressService: EgressService,
    private readonly auditService: AuditService,
  ) {
    this.recordingsRoot = this.configService.get('RECORDINGS_ROOT', '/var/recordings');
    this.s3Bucket = this.configService.get('S3_BUCKET', 'webinar-recordings');
    this.s3Client = new S3Client({
      endpoint: this.configService.get('S3_ENDPOINT', 'http://localhost:9000'),
      region: this.configService.get('S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get('S3_SECRET_KEY', 'minioadmin'),
      },
      // MinIO requires path-style addressing
      forcePathStyle: true,
    });
  }

  async startRecording(sessionId: string, userId: string): Promise<RecordingResponse> {
    // Validate session exists and is LIVE
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    // GAP-04: Only the session instructor may start a recording.
    // userId is required — never allow the ownership check to be skipped.
    if (session.instructorId !== userId) {
      throw new ForbiddenException('Only the session instructor can start a recording');
    }

    if (session.status !== SessionStatus.LIVE) {
      throw new BadRequestException(`Session must be LIVE to start recording. Current status: ${session.status}`);
    }

    const existingRecording = await this.recordingRepository.findOne({
      where: {
        sessionId,
        status: RecordingStatus.RECORDING_ACTIVE,
      },
    });

    if (existingRecording) {
      throw new BadRequestException('Recording already in progress for this session');
    }

    const recordingId = randomUUID();
    const egressId = randomUUID();

    const recording = this.recordingRepository.create({
      id: recordingId,
      sessionId,
      status: RecordingStatus.RECORDING_STARTING,
      startedAt: new Date(),
    });

    await this.recordingRepository.save(recording);

    this.logger.log(`Created recording ${recordingId} with status RECORDING_STARTING`);

    try {
      const sessionDir = this.getSessionDirectory(sessionId);
      await this.ensureDirectoryExists(sessionDir);
      await this.ensureDirectoryExists(path.join(sessionDir, 'raw'));

      const rawFilename = `${egressId}.mp4`;
      const rawPath = path.join(sessionDir, 'raw', rawFilename);

      const roomName = session.liveKitRoomName;

      this.logger.log(`Starting LiveKit Egress for room ${roomName}`);

      const egressResult = await this.egressService.startRoomCompositeEgress({
        roomName,
        outputPath: rawPath,
      });

      recording.egressId = egressResult.egressId;
      recording.rawPath = rawPath;
      recording.status = RecordingStatus.RECORDING_ACTIVE;

      await this.recordingRepository.save(recording);

      this.logger.log(`Recording ${recordingId} now RECORDING_ACTIVE with egress ${egressResult.egressId}`);

      await this.auditService.log(AuditAction.RECORDING_START, {
        userId,
        sessionId,
        recordingId,
        metadata: {
          egressId: egressResult.egressId,
          rawPath,
        },
      });

      return this.toResponse(recording);
    } catch (error) {
      this.logger.error(`Failed to start recording ${recordingId}`, error);

      recording.status = RecordingStatus.FAILED;
      recording.error = error.message;
      await this.recordingRepository.save(recording);

      throw new InternalServerErrorException('Failed to start recording');
    }
  }

  async stopRecording(sessionId: string, userId: string): Promise<RecordingResponse> {
    // Validate session exists
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    // GAP-04: Only the session instructor may stop a recording.
    // userId is required — never allow the ownership check to be skipped.
    if (session.instructorId !== userId) {
      throw new ForbiddenException('Only the session instructor can stop a recording');
    }

    const recording = await this.recordingRepository.findOne({
      where: {
        sessionId,
        status: RecordingStatus.RECORDING_ACTIVE,
      },
    });

    if (!recording) {
      throw new NotFoundException('No active recording found for this session');
    }

    this.logger.log(`Stopping recording ${recording.id}`);

    try {
      if (recording.egressId) {
        await this.egressService.stopEgress(recording.egressId);
        this.logger.log(`LiveKit Egress ${recording.egressId} stopped`);
      }

      recording.status = RecordingStatus.PROCESSING_QUEUED;
      recording.stoppedAt = new Date();

      await this.recordingRepository.save(recording);

      this.logger.log(`Recording ${recording.id} marked as PROCESSING_QUEUED`);

      await this.recordingQueue.add('process-recording', {
        recordingId: recording.id,
        sessionId: recording.sessionId,
        rawPath: recording.rawPath,
      });

      this.logger.log(`Queued processing job for recording ${recording.id}`);

      await this.auditService.log(AuditAction.RECORDING_STOP, {
        userId,
        sessionId,
        recordingId: recording.id,
        metadata: {
          egressId: recording.egressId,
          duration: recording.stoppedAt.getTime() - recording.startedAt.getTime(),
        },
      });

      return this.toResponse(recording);
    } catch (error) {
      this.logger.error(`Failed to stop recording ${recording.id}`, error);

      recording.status = RecordingStatus.FAILED;
      recording.error = error.message;
      await this.recordingRepository.save(recording);

      throw new InternalServerErrorException('Failed to stop recording');
    }
  }

  async getRecording(sessionId: string): Promise<RecordingResponse> {
    const recording = await this.recordingRepository.findOne({
      where: { sessionId },
      order: { createdAt: 'DESC' },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found for this session');
    }

    return this.toResponse(recording);
  }

  async updateRecordingStatus(
    recordingId: string,
    status: RecordingStatus,
    updates?: Partial<RecordingEntity>,
  ): Promise<void> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    recording.status = status;

    if (updates) {
      Object.assign(recording, updates);
    }

    await this.recordingRepository.save(recording);

    this.logger.log(`Updated recording ${recordingId} status to ${status}`);
  }

  /**
   * Generate a signed MinIO/S3 URL for downloading a completed recording.
   * URL expires in 60 minutes. Only the session instructor may download.
   */
  async getDownloadUrl(recordingId: string, userId: string): Promise<string> {
    const recording = await this.recordingRepository.findOne({
      where: { id: recordingId },
      relations: ['session'],
    });

    if (!recording) {
      throw new NotFoundException('Recording not found');
    }

    if (recording.status !== RecordingStatus.READY) {
      throw new BadRequestException(
        `Recording is not ready for download (status: ${recording.status}). Please try again when processing is complete.`,
      );
    }

    // Verify the requesting user owns the session
    const session = await this.sessionRepository.findOne({
      where: { id: recording.sessionId },
    });
    if (!session || session.instructorId !== userId) {
      throw new ForbiddenException('Only the session instructor can download recordings');
    }

    // storagePath holds the S3/MinIO object key set by the worker after upload.
    // Fall back to finalPath (local disk) for older recordings not yet on MinIO.
    if (!recording.storagePath && !recording.finalPath) {
      throw new InternalServerErrorException('Recording file location is unknown');
    }

    if (recording.storagePath) {
      // Generate a 60-minute presigned URL from MinIO
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: recording.storagePath,
        ResponseContentDisposition: `attachment; filename="recording-${recordingId}.mp4"`,
      });
      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
      this.logger.log(`Generated presigned download URL for recording ${recordingId}`);
      return url;
    }

    // Legacy: serve via local filesystem path (will be removed once all recordings are on MinIO)
    throw new InternalServerErrorException(
      'Recording file is not available for download (MinIO storage not configured for this recording)',
    );
  }

  private toResponse(recording: RecordingEntity): RecordingResponse {
    const response: RecordingResponse = {
      id: recording.id,
      status: recording.status,
    };

    if (recording.duration) {
      response.duration = recording.duration;
    }

    if (recording.fileSize) {
      response.fileSize = Number(recording.fileSize);
    }

    if (recording.resolution) {
      response.resolution = recording.resolution;
    }

    if (recording.status === RecordingStatus.READY && recording.finalPath) {
      response.downloadUrl = `/recordings/${recording.id}/download`;
    }

    return response;
  }

  private getSessionDirectory(sessionId: string): string {
    const sanitized = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
    return path.join(this.recordingsRoot, sanitized);
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory ${dir}`, error);
      throw error;
    }
  }
}
