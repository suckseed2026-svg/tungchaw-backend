import { Module } from '@nestjs/common';
import { InventoryBatchesController } from './inventory-batches.controller';
import { InventoryBatchesService } from './inventory-batches.service';

@Module({
  controllers: [InventoryBatchesController],
  providers: [InventoryBatchesService],
  exports: [InventoryBatchesService],
})
export class InventoryBatchesModule {}
