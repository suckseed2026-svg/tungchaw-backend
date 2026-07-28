import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export enum DashboardPeriod {
  TODAY = 'TODAY',
  YESTERDAY = 'YESTERDAY',
  THIS_WEEK = 'THIS_WEEK',
  LAST_7_DAYS = 'LAST_7_DAYS',
  THIS_MONTH = 'THIS_MONTH',
  LAST_30_DAYS = 'LAST_30_DAYS',
  THIS_YEAR = 'THIS_YEAR',
  CUSTOM = 'CUSTOM',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Optional branch UUID. When omitted, data is aggregated across accessible branches.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Dashboard reporting period',
    enum: DashboardPeriod,
    default: DashboardPeriod.TODAY,
    example: DashboardPeriod.THIS_MONTH,
  })
  @IsOptional()
  @IsEnum(DashboardPeriod)
  period?: DashboardPeriod = DashboardPeriod.TODAY;

  @ApiPropertyOptional({
    description:
      'Custom range start date in ISO 8601 format. Required when period is CUSTOM.',
    example: '2026-07-01T00:00:00.000Z',
  })
  @ValidateIf((dto: DashboardQueryDto) => dto.period === DashboardPeriod.CUSTOM)
  @IsISO8601(
    { strict: true },
    {
      message: 'fromDate must be a valid ISO 8601 date when period is CUSTOM',
    },
  )
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'Custom range end date in ISO 8601 format. Required when period is CUSTOM.',
    example: '2026-08-01T00:00:00.000Z',
  })
  @ValidateIf((dto: DashboardQueryDto) => dto.period === DashboardPeriod.CUSTOM)
  @IsISO8601(
    { strict: true },
    {
      message: 'toDate must be a valid ISO 8601 date when period is CUSTOM',
    },
  )
  toDate?: string;

  @ApiPropertyOptional({
    description:
      'Maximum number of rows returned by ranked lists and activity feeds',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description:
      'Legacy number-of-days filter used by existing dashboard endpoints',
    example: 7,
    default: 7,
    minimum: 1,
    maximum: 365,
    deprecated: true,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 7;
}
