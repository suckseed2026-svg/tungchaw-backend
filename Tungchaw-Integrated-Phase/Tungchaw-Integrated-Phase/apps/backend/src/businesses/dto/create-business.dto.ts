import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BusinessIndustry } from '../../generated/prisma/enums';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({
    example: 'Zorama Enterprise',
  })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty({
    example: 'ZORAMA',
    description: 'Unique business code',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    enum: BusinessIndustry,
    default: BusinessIndustry.GENERAL_RETAIL,
    description: 'Business industry used to choose sensible inventory defaults',
  })
  @IsOptional()
  @IsEnum(BusinessIndustry)
  industry: BusinessIndustry = BusinessIndustry.GENERAL_RETAIL;

  @ApiPropertyOptional({
    example: '+91 9876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'owner@zorama.in',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'Champhai, Mizoram',
  })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}
