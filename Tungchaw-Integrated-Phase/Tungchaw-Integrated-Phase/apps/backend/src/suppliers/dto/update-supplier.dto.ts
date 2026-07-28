import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateSupplierDto } from './create-supplier.dto';

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the supplier is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
