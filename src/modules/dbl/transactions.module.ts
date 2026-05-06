import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IfcElementTransaction } from './entities/ifc-element-transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IfcElementTransaction])],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
