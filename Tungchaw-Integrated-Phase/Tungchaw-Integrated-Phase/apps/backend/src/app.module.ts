import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';

import { AuthModule } from './auth/auth.module';

import { BusinessesModule } from './businesses/businesses.module';
import { BranchesModule } from './branches/branches.module';

import { CategoriesModule } from './categories/categories.module';
import { BrandsModule } from './brands/brands.module';
import { UnitsModule } from './units/units.module';
import { ProductsModule } from './products/products.module';

import { SuppliersModule } from './suppliers/suppliers.module';
import { PurchasesModule } from './purchases/purchases.module';
import { PurchasePaymentsModule } from './purchase-payments/purchase-payments.module';
import { PurchaseReturnsModule } from './purchase-returns/purchase-returns.module';

import { CustomersModule } from './customers/customers.module';
import { CustomerPaymentsModule } from './customer-payments/customer-payments.module';

import { SalesModule } from './sales/sales.module';
import { SalesReturnsModule } from './sales-returns/sales-returns.module';

import { InventoryAdjustmentsModule } from './inventory-adjustments/inventory-adjustments.module';
import { InventoryBatchesModule } from './inventory-batches/inventory-batches.module';
import { StockTransfersModule } from './stock-transfers/stock-transfers.module';

import { DashboardModule } from './dashboard/dashboard.module';
import { ExpenseCategoriesModule } from './expense-categories/expense-categories.module';
import { ExpensesModule } from './expenses/expenses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    PrismaModule,
    HealthModule,
    AuthModule,

    BusinessesModule,
    BranchesModule,

    CategoriesModule,
    BrandsModule,
    UnitsModule,
    ProductsModule,

    SuppliersModule,
    PurchasesModule,
    PurchasePaymentsModule,
    PurchaseReturnsModule,

    CustomersModule,
    CustomerPaymentsModule,

    SalesModule,
    SalesReturnsModule,

    InventoryBatchesModule,
    InventoryAdjustmentsModule,
    StockTransfersModule,

    DashboardModule,
    ExpenseCategoriesModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
