import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ApiTags } from '@nestjs/swagger';
import { IfcElementTransaction } from './entities/ifc-element-transaction.entity';

@ApiTags('DBL Transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get(':guid')
  async getTransactionSummary(
    @Param('guid') guid: string,
  ): Promise<IfcElementTransaction[]> {
    return this.transactionsService.getTransactionSummary(guid);
  }

  @Post()
  async insertTransaction(
    @Body() data: Partial<IfcElementTransaction>,
  ): Promise<IfcElementTransaction> {
    return this.transactionsService.insertTransaction(data);
  }
}
