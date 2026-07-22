import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
export class CancelSaleDto {
  @ApiProperty({ example: 'Customer cancelled the order' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
