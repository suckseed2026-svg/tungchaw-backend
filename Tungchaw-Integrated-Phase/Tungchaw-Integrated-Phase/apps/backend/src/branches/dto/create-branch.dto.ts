import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({
    example: 'Main Shop',
  })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    example: 'MAIN',
    description: 'Unique code inside this business',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    example: '+91 9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'Champhai, Mizoram',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}
