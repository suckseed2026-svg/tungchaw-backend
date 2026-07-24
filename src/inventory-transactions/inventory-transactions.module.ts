import { Module } from '@nestjs/common';
import { InventoryTransactionService } from './inventory-transaction.service';

@Module({
  providers: [InventoryTransactionService],
  exports: [InventoryTransactionService],
})
export class InventoryTransactionsModule {}