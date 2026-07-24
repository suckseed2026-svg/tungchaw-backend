import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BusinessContextModule } from '../business-context/business-context.module';
import { InventoryTransactionsModule } from '../inventory-transactions/inventory-transactions.module';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';

@Module({
  imports: [
    AuthModule,
    BusinessContextModule,
    AuthorizationModule,
    InventoryTransactionsModule,
  ],
  controllers: [PurchaseReturnsController],
  providers: [PurchaseReturnsService],
  exports: [PurchaseReturnsService],
})
export class PurchaseReturnsModule {}
