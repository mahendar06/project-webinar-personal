import { IsOptional, IsInt, Min, Max, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { UserRole, SessionStatus, RecordingStatus } from '@webinar/shared';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class UserFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class SessionFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RecordingFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RecordingStatus)
  status?: RecordingStatus;
}
