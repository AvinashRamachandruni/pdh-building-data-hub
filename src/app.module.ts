import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SensorsModule } from './sensors/sensors.module';
import { RdfModule } from './rdf/rdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true, // Make the configuration globally available
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: `${configService.get<string>('MONGO_SERVER')}/${configService.get<string>('MONGO_DB')}`,
      }),
      inject: [ConfigService],
    }),
    SensorsModule,
    RdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
