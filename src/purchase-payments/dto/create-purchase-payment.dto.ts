import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreatePurchasePaymentDto {
  @ApiProperty({
    example: 1000,
    minimum: 0.01,
    description: 'Amount paid toward the purchase',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    enum: PaymentMethod,
    example: PaymentMethod.CASH,
  })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({
    example: '2026-07-18',
    description: 'Payment date in ISO format',
  })
  @IsDateString()
  paymentDate!: string;

  @ApiPropertyOptional({
    example: 'UPI-TXN-984512',
    description: 'Bank, UPI, cheque, or other external reference',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;

  @ApiPropertyOptional({
    example: 'First partial payment',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
