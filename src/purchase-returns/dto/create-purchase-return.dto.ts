import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreatePurchaseReturnItemDto {
  @ApiProperty({
    description: 'Purchase item UUID being returned',
    example: 'b2b4f450-74af-4a23-bb62-33c832d0de2f',
  })
  @IsUUID()
  purchaseItemId!: string;

  @ApiProperty({
    description: 'Quantity returned to the supplier',
    example: 2,
    minimum: 0.001,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Reason specific to this purchase item',
    example: 'Damaged packaging',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  itemReason?: string;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({
    type: [CreatePurchaseReturnItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];

  @ApiPropertyOptional({
    description: 'Amount refunded by the supplier',
    example: 500,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({
    description:
      'Amount applied as supplier credit. Refund plus credit must equal the return total.',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditAdjustmentAmount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Required when refundAmount is greater than zero',
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  refundMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Supplier refund transaction reference',
    example: 'UTR-20260725-001',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @ApiProperty({
    description: 'Overall reason for the purchase return',
    example: 'Goods received damaged',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    example: 'Supplier confirmed the return by phone.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
