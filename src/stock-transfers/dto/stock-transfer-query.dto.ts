import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { StockTransferStatus } from '../../generated/prisma/client';

export class StockTransferQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by source branch UUID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  fromBranchId?: string;

  @ApiPropertyOptional({
    description: 'Filter by destination branch UUID',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  toBranchId?: string;

  @ApiPropertyOptional({ enum: StockTransferStatus })
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @ApiPropertyOptional({
    description: 'Inclusive start date in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Inclusive end date in ISO 8601 format',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      'Search by transfer number, reference number, product name, or product code',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
