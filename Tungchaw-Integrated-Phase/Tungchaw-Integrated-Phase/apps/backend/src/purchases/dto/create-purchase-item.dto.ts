import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePurchaseItemDto {
  @ApiProperty({
    example: 'aa6a4dfa-7b0d-4fcd-8f87-313ff91524e9',
    description: 'Product UUID belonging to the selected business',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    example: 100,
    minimum: 0.001,
    description: 'Quantity purchased',
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({
    example: 8.5,
    minimum: 0,
    description: 'Cost for one unit of the product',
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  unitCost!: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    default: 0,
    description: 'Discount amount for this purchase line',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  discountAmount: number = 0;

  @ApiPropertyOptional({
    example: 45,
    minimum: 0,
    default: 0,
    description: 'Tax amount for this purchase line',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  taxAmount: number = 0;

  @ApiPropertyOptional({
    example: 'PCM-JUL-2026-A1',
    description: 'Manufacturer or supplier batch number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  batchNumber?: string;

  @ApiPropertyOptional({
    example: '2026-06-01',
    description: 'Manufacturing date in ISO format',
  })
  @IsOptional()
  @IsDateString()
  manufacturedAt?: string;

  @ApiPropertyOptional({
    example: '2028-05-31',
    description: 'Expiry date in ISO format',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}
