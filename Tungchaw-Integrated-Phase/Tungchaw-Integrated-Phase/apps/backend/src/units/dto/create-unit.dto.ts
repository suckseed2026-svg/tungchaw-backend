import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({
    example: 'Piece',
    description: 'Unit display name',
  })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({
    example: 'PCS',
    description: 'Unique unit code inside the selected business',
  })
  @IsString()
  @Length(1, 30)
  code!: string;

  @ApiProperty({
    example: 'pc',
    description: 'Short unit symbol shown in product quantities',
  })
  @IsString()
  @Length(1, 20)
  symbol!: string;

  @ApiPropertyOptional({
    example: 'A single countable item',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
