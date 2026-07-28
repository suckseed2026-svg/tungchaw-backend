import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateExpenseCategoryDto {
  @ApiProperty({ example: 'Electricity' })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({ example: 'ELECTRICITY' })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({ example: 'Electricity and utility bills' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
