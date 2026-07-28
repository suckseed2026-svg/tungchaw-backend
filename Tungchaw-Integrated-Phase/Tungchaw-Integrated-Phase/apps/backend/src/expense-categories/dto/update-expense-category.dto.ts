import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateExpenseCategoryDto } from './create-expense-category.dto';

export class UpdateExpenseCategoryDto extends PartialType(CreateExpenseCategoryDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
