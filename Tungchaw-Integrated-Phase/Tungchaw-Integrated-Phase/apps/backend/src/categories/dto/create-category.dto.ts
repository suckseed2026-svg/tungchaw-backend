import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Medicines',
    description: 'Category display name',
  })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    example: 'MEDICINES',
    description: 'Unique category code inside the selected business',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    example: 'Prescription and over-the-counter medicines',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
