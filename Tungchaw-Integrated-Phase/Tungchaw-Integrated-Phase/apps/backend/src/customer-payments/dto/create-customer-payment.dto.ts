import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/client';

export class CreateCustomerPaymentDto {
  @ApiPropertyOptional({
    example: 'a2cce88d-9e5a-43c0-b450-6dd20313fcab',
    description: 'Branch where the payment was received',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    example: 3,
    minimum: 0.01,
    description: 'Amount received from the customer',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({
    example: '2026-07-22T10:30:00.000Z',
    description: 'Payment date in ISO 8601 format',
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

  @ApiPropertyOptional({ example: 'Partial repayment of outstanding credit' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
