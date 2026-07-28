import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({
    example: 'Mizoram Medical Distributor',
    description: 'Supplier business name',
  })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({
    example: 'MMD',
    description: 'Unique supplier code inside the selected business',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    example: 'Lalrinmawia',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactName?: string;

  @ApiPropertyOptional({
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'sales@mmd.in',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    example: 'Aizawl, Mizoram',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({
    example: '15ABCDE1234F1Z5',
    description: 'Optional GST registration number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gstNumber?: string;

  @ApiPropertyOptional({
    example: 'Primary pharmaceutical supplier',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
