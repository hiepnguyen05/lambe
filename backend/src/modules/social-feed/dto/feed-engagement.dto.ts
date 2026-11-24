import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class FeedEngagementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  clientEventId: string;

  @ApiProperty({
    enum: ['VIEW', 'DWELL', 'SKIP', 'OPEN_SERVICE', 'START_BOOKING'],
  })
  @IsIn(['VIEW', 'DWELL', 'SKIP', 'OPEN_SERVICE', 'START_BOOKING'])
  kind: 'VIEW' | 'DWELL' | 'SKIP' | 'OPEN_SERVICE' | 'START_BOOKING';

  @ApiPropertyOptional({ minimum: 0, maximum: 300000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300000)
  durationMs?: number;
}
