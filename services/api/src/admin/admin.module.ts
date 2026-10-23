import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserEntity } from '../database/entities/user.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { RecordingEntity } from '../database/entities/recording.entity';
import { SessionParticipantEntity } from '../database/entities/session-participant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      SessionEntity,
      RecordingEntity,
      SessionParticipantEntity,
    ]),
    BullModule.registerQueue({ name: 'recording' }),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
