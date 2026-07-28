import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'Paracetamol 500mg',
    description: 'Product display name',
  })
  @IsString()
  @Length(2, 180)
  name!: string;

  @ApiProperty({
    example: 'PCM500',
    description: 'Unique product code inside the selected business',
  })
  @IsString()
  @Length(1, 50)
  code!: string;

  @ApiPropertyOptional({
    example: '8901234567890',
    description: 'Optional barcode unique within the selected business',
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  barcode?: string;

  @ApiPropertyOptional({
    example: 'Pain reliever and fever reducer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    example: '92f92dca-6d90-4f30-80ce-8eaec933bc40',
    description: 'Category UUID from the selected business',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({
    example: '63535b6c-3503-4a39-b117-19fccbbaa07b',
    description: 'Unit UUID from the selected business',
  })
  @IsUUID()
  unitId!: string;

  @ApiPropertyOptional({
    example: 'bb4bb8ce-49b6-451f-a105-30766ccede91',
    description: 'Brand UUID from the selected business',
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiProperty({
    example: 10,
    minimum: 0,
    maximum: 9999999999999999.99,
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Max(9999999999999999.99)
  costPrice!: number;

  @ApiProperty({
    example: 15,
    minimum: 0,
    maximum: 9999999999999999.99,
  })
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  @Max(9999999999999999.99)
  sellingPrice!: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether inventory quantity should be tracked',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  trackStock?: boolean;

  @ApiPropertyOptional({ description: 'Track product batches; inherits the business default when omitted' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  trackBatch?: boolean;

  @ApiPropertyOptional({ description: 'Track expiry dates; inherits the business default when omitted' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({ description: 'Require a batch number when purchasing this product' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  requireBatchOnPurchase?: boolean;

  @ApiPropertyOptional({ description: 'Require an expiry date when purchasing this product' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  requireExpiryOnPurchase?: boolean;

  @ApiPropertyOptional({ description: 'Block sale allocation from expired batches' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  blockExpiredSale?: boolean;

  @ApiPropertyOptional({ description: 'Use FEFO allocation when batch inventory is available' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  useFefo?: boolean;

  @ApiPropertyOptional({ description: 'Track product serial numbers' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  trackSerialNumber?: boolean;
}

