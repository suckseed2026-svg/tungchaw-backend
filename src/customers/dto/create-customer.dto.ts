import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Customer name',
  })
  @IsString()
  @Length(2, 150)
  name!: string;

  @ApiProperty({
    example: 'CUS001',
    description: 'Unique customer code inside the selected business',
  })
  @IsString()
  @Length(2, 30)
  code!: string;

  @ApiPropertyOptional({
    example: '+919876543210',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'john@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({
    example: 'Champhai, Mizoram',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Maximum credit allowed',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Opening balance',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openingBalance?: number;

  @ApiPropertyOptional({
    example: 'VIP customer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}