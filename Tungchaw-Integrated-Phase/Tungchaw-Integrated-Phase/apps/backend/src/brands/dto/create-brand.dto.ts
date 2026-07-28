import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({
    example: 'Cipla',
    description: 'Brand display name',
  })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    example: 'CIPLA',
    description: 'Unique brand code inside the selected business',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    example: 'Pharmaceutical products manufactured by Cipla',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
