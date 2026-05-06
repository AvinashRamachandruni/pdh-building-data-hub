import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { SensorsModule } from '../sensors/sensors.module';
import { RdfModule } from '../rdf/rdf.module';

@Module({
  imports: [SensorsModule, RdfModule],
  controllers: [AssetsController],
  providers: [AssetsService],
})
export class AssetsModule {}
