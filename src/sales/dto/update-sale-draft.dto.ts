import { PartialType } from '@nestjs/swagger';
import { CreateSaleDraftDto } from './create-sale-draft.dto';
export class UpdateSaleDraftDto extends PartialType(CreateSaleDraftDto) {}
