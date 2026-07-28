import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InventoryAdjustmentReason,
  InventoryAdjustmentType,
} from '../../generated/prisma/client';

export class CreateInventoryAdjustmentItemDto {
  @ApiProperty({
    description: 'Product UUID',
    format: 'uuid',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: 'Quantity to add or remove',
    example: 2.5,
    minimum: 0.001,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional reason specific to this line item',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  itemReason?: string;

  @ApiPropertyOptional({
    description: 'Optional notes specific to this line item',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateInventoryAdjustmentDto {
  @ApiProperty({
    description: 'Branch where stock will be adjusted',
    format: 'uuid',
  })
  @IsUUID()
  branchId!: string;

  @ApiProperty({
    enum: InventoryAdjustmentType,
    description: 'Whether stock should be increased or decreased',
  })
  @IsEnum(InventoryAdjustmentType)
  type!: InventoryAdjustmentType;

  @ApiProperty({
    enum: InventoryAdjustmentReason,
    description: 'Primary reason for the adjustment',
  })
  @IsEnum(InventoryAdjustmentReason)
  reason!: InventoryAdjustmentReason;

  @ApiPropertyOptional({
    description: 'External or internal reference number',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'General notes about the adjustment',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({
    type: [CreateInventoryAdjustmentItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryAdjustmentItemDto)
  items!: CreateInventoryAdjustmentItemDto[];
}
