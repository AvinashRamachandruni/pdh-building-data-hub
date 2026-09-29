import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpSourceAdapterService } from './adapters/http-source-adapter.service';
import { WeatherController } from './weather.controller';
import { ExternalSourcesController } from './external-sources.controller';

@Module({
  imports: [ConfigModule],
  controllers: [WeatherController, ExternalSourcesController],
  providers: [HttpSourceAdapterService],
  exports: [HttpSourceAdapterService],
})
export class ExternalModule {}
