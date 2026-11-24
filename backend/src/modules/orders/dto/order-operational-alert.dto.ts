import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ResolveOrderOperationalAlertDto {
  @ApiProperty({ minLength: 5, maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  resolutionNote: string;
}

export class CancelStaleOrderDto extends ResolveOrderOperationalAlertDto {}
