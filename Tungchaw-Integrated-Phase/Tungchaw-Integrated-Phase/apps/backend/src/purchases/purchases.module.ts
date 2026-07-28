import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BusinessContextModule } from '../business-context/business-context.module';
import { InventoryTransactionsModule } from '../inventory-transactions/inventory-transactions.module';
import { InventoryBatchesModule } from '../inventory-batches/inventory-batches.module';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [
    AuthModule,
    BusinessContextModule,
    AuthorizationModule,
    InventoryTransactionsModule,
    InventoryBatchesModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
