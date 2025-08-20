import { Module } from '@nestjs/common';
import { RdfController } from './rdf.controller';
import { RdfService } from './rdf.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [RdfController],
  providers: [RdfService],
  exports: [RdfService],
})
export class RdfModule {}
