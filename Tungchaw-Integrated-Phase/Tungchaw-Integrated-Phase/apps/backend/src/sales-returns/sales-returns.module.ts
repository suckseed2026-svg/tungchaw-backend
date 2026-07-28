import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BusinessContextModule } from '../business-context/business-context.module';
import { InventoryBatchesModule } from '../inventory-batches/inventory-batches.module';
import { InventoryTransactionsModule } from '../inventory-transactions/inventory-transactions.module';
import { SalesReturnsController } from './sales-returns.controller';
import { SalesReturnsService } from './sales-returns.service';

@Module({
  imports: [
    AuthModule,
    BusinessContextModule,
    AuthorizationModule,
    InventoryTransactionsModule,
    InventoryBatchesModule,
  ],
  controllers: [SalesReturnsController],
  providers: [SalesReturnsService],
  exports: [SalesReturnsService],
})
export class SalesReturnsModule {}
