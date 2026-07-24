import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CancelPurchaseReturnDto {
  @ApiProperty({
    description: 'Reason for cancelling the purchase return',
    example: 'Return entered against the wrong purchase',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
