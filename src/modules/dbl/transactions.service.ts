import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IfcElementTransaction } from './entities/ifc-element-transaction.entity';

@Injectable()
export class TransactionsService {
  readonly logger = new Logger(TransactionsService.name);
  constructor(
    @InjectRepository(IfcElementTransaction)
    private readonly txRepo: Repository<IfcElementTransaction>,
  ) {}

  async getTransactionSummary(
    parentGuid: string,
  ): Promise<IfcElementTransaction[]> {
    return this.txRepo.find({
      where: { parent_guid: parentGuid },
      order: { change_timestamp: 'DESC' },
    });
  }

  async insertTransaction(
    data: Partial<IfcElementTransaction>,
  ): Promise<IfcElementTransaction> {
    const tx = this.txRepo.create(data);
    return this.txRepo.save(tx);
  }
}
