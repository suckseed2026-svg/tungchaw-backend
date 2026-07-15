import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BusinessContextGuard } from './guards/business-context.guard';

@Module({
  imports: [PrismaModule],
  providers: [BusinessContextGuard],
  exports: [BusinessContextGuard],
})
export class BusinessContextModule {}
