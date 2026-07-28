import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { SaleReturnItemCondition } from '../../generated/prisma/client';

export class CreateSaleReturnItemDto {
  @ApiProperty({
    format: 'uuid',
    description: 'UUID of the original SaleItem being returned.',
  })
  @IsUUID()
  saleItemId!: string;

  @ApiProperty({
    example: 1,
    minimum: 0.001,
    description: 'Quantity being returned from the original sale item.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiPropertyOptional({
    enum: SaleReturnItemCondition,
    default: SaleReturnItemCondition.RESTOCKABLE,
    description: 'Physical condition of the returned item.',
  })
  @IsOptional()
  @IsEnum(SaleReturnItemCondition)
  condition?: SaleReturnItemCondition;

  @ApiPropertyOptional({
    default: true,
    description:
      'Whether the returned quantity should be restored to branch inventory.',
  })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;

  @ApiPropertyOptional({
    example: 'Customer returned unopened item',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  itemReason?: string;
}
