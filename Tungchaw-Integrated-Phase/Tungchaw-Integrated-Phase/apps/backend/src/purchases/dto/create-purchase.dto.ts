import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreatePurchaseItemDto } from './create-purchase-item.dto';

export class CreatePurchaseDto {
  @ApiProperty({
    example: 'a2cce88d-9e5a-43c0-b450-6dd20313fcab',
    description: 'Branch that will receive the purchased stock',
  })
  @IsUUID()
  branchId!: string;

  @ApiProperty({
    example: '4f09b246-36cc-4370-b0bc-e8c77428924d',
    description: 'Active supplier UUID from the selected business',
  })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({
    example: 'PUR-2026-0001',
    description: 'Unique internal purchase invoice number',
  })
  @IsString()
  @MaxLength(60)
  invoiceNumber!: string;

  @ApiPropertyOptional({
    example: 'SUP-INV-9841',
    description: 'Invoice number printed by the supplier',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierInvoiceNumber?: string;

  @ApiProperty({
    example: '2026-07-14',
    description: 'Purchase date in ISO format',
  })
  @IsDateString()
  purchaseDate!: string;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
    default: 0,
    description: 'Invoice-level discount amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({
    example: 50,
    minimum: 0,
    default: 0,
    description: 'Invoice-level tax amount',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    default: 0,
    description: 'Transport, handling, or other invoice charges',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  otherCharges?: number;

  @ApiPropertyOptional({
    example: 'Deliver to the main branch warehouse',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    type: CreatePurchaseItemDto,
    isArray: true,
    description: 'Products included in the purchase',
    example: [
      {
        productId: 'aa6a4dfa-7b0d-4fcd-8f87-313ff91524e9',
        quantity: 100,
        unitCost: 8.5,
        discountAmount: 20,
        taxAmount: 45,
        batchNumber: 'PCM-JUL-2026-A1',
        manufacturedAt: '2026-06-01',
        expiryDate: '2028-05-31',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];
}
