import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';
import { CreateSaleReturnItemDto } from './create-sale-return-item.dto';

export class CreateSaleReturnDto {
  @ApiProperty({
    type: CreateSaleReturnItemDto,
    isArray: true,
    description: 'Original sale items and quantities being returned.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items!: CreateSaleReturnItemDto[];

  @ApiProperty({
    example: 'Customer returned unwanted items',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    description: 'Amount refunded directly to the customer.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  refundAmount?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    description:
      "Amount deducted from the customer's outstanding credit balance.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditAdjustmentAmount?: number;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description:
      'Method used to refund the customer. Required when refundAmount is greater than zero.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  refundMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: 'REF-2026-001',
    maxLength: 150,
    description: 'External refund or transaction reference.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  referenceNumber?: string;

  @ApiPropertyOptional({
    example: 'Returned at the Champhai main branch',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
