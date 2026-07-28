import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchasePaymentsController } from './purchase-payments.controller';
import { PurchasePaymentsService } from './purchase-payments.service';

@Module({
  imports: [PrismaModule],
  controllers: [PurchasePaymentsController],
  providers: [PurchasePaymentsService],
  exports: [PurchasePaymentsService],
})
export class PurchasePaymentsModule {}
