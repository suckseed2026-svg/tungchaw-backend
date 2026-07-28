import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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

export class CreateStockTransferItemDto {
  @ApiProperty({
    description: 'Product UUID',
    format: 'uuid',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: 'Quantity to transfer',
    example: 5,
    minimum: 0.001,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Optional notes for this transferred item',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateStockTransferDto {
  @ApiProperty({
    description: 'Source branch UUID',
    format: 'uuid',
  })
  @IsUUID()
  fromBranchId!: string;

  @ApiProperty({
    description: 'Destination branch UUID',
    format: 'uuid',
  })
  @IsUUID()
  toBranchId!: string;

  @ApiPropertyOptional({
    description:
      'Transfer date in ISO 8601 format. Defaults to the current date and time.',
  })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional({
    description: 'External or internal reference number',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNumber?: string;

  @ApiPropertyOptional({
    description: 'General notes about the stock transfer',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiProperty({
    type: [CreateStockTransferItemDto],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStockTransferItemDto)
  items!: CreateStockTransferItemDto[];
}
