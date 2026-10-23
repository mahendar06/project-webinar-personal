import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindManyOptions } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { UserEntity } from '../database/entities/user.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { RecordingEntity } from '../database/entities/recording.entity';
import { SessionParticipantEntity } from '../database/entities/session-participant.entity';
import { UserFilterDto, SessionFilterDto, RecordingFilterDto } from './dto/admin-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessionRepo: Repository<SessionEntity>,
    @InjectRepository(RecordingEntity)
    private readonly recordingRepo: Repository<RecordingEntity>,
    @InjectRepository(SessionParticipantEntity)
    private readonly participantRepo: Repository<SessionParticipantEntity>,
    @InjectQueue('recording')
    private readonly recordingQueue: Queue,
  ) {}

  async listUsers(filter: UserFilterDto): Promise<PaginatedResult<UserEntity>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.role) where.role = filter.role;

    const [data, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listSessions(filter: SessionFilterDto): Promise<PaginatedResult<SessionEntity>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const findOpts: FindManyOptions<SessionEntity> = {
      relations: ['instructor'],
      order: { scheduledAt: 'DESC' },
      skip,
      take: limit,
      where: {},
    };

    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.from && filter.to) {
      where.scheduledAt = Between(new Date(filter.from), new Date(filter.to));
    }
    findOpts.where = where;

    const [data, total] = await this.sessionRepo.findAndCount(findOpts);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSessionDetail(sessionId: string): Promise<SessionEntity | null> {
    return this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['instructor'],
    });
  }

  async getSessionAttendance(sessionId: string): Promise<SessionParticipantEntity[]> {
    return this.participantRepo.find({
      where: { sessionId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  async listRecordings(filter: RecordingFilterDto): Promise<PaginatedResult<RecordingEntity>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;

    const [data, total] = await this.recordingRepo.findAndCount({
      where,
      relations: ['session'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getFailedJobs(): Promise<unknown[]> {
    try {
      const failed = await this.recordingQueue.getFailed();
      return failed.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        attemptsMade: job.attemptsMade,
      }));
    } catch (err: any) {
      this.logger.error(`Failed to fetch DLQ jobs: ${err.message}`);
      return [];
    }
  }
}
