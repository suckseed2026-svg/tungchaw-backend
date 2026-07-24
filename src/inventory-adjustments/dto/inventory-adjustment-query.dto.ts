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
import {
  InventoryAdjustmentReason,
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
} from '../../generated/prisma/client';

export class InventoryAdjustmentQueryDto {
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

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: InventoryAdjustmentType })
  @IsOptional()
  @IsEnum(InventoryAdjustmentType)
  type?: InventoryAdjustmentType;

  @ApiPropertyOptional({ enum: InventoryAdjustmentReason })
  @IsOptional()
  @IsEnum(InventoryAdjustmentReason)
  reason?: InventoryAdjustmentReason;

  @ApiPropertyOptional({ enum: InventoryAdjustmentStatus })
  @IsOptional()
  @IsEnum(InventoryAdjustmentStatus)
  status?: InventoryAdjustmentStatus;

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
      'Search by adjustment number, reference number, product name, or product code',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
