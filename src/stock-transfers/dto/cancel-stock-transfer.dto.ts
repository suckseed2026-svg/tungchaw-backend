import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelStockTransferDto {
  @ApiProperty({
    description: 'Reason for cancelling this stock transfer',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
