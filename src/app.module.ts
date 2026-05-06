import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SensorsModule } from './modules/sensors/sensors.module';
import { RdfModule } from './modules/rdf/rdf.module';
import { AssetsModule } from './modules/assets/assets.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from './modules/dbl/transactions.module';
import { ToolsModule } from './modules/tools/tools.module';
import { buildMongoUri } from './config/mongo-uri.util';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const uri = `${buildMongoUri(
          configService.get<string>('MONGO_SERVER'),
          configService.get<string>('MONGO_DB'),
          'bimsim',
        )}?retryWrites=true&w=majority&appName=wilson-mongo`;
        console.log('MongoDB URI:', uri);
        return { uri };
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('SQL_DB_URL'),
        database: config.get<string>('SQL_DB_NAME'),
        autoLoadEntities: true,
        synchronize: false, // set true only for dev
      }),
    }),
    SensorsModule,
    RdfModule,
    AssetsModule,
    ToolsModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
