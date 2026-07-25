import { Module } from '@nestjs/common';
import { InventoryTransactionsModule } from '../inventory-transactions/inventory-transactions.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StockTransfersController } from './stock-transfers.controller';
import { StockTransfersService } from './stock-transfers.service';

@Module({
  imports: [PrismaModule, InventoryTransactionsModule],
  controllers: [StockTransfersController],
  providers: [StockTransfersService],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}
