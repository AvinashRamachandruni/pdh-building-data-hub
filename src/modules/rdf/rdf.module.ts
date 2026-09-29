import { Module } from '@nestjs/common';
import { RdfController } from './rdf.controller';
import { RdfService } from './rdf.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [ConfigModule, CacheModule],
  controllers: [RdfController],
  providers: [RdfService],
  exports: [RdfService],
})
export class RdfModule {}
