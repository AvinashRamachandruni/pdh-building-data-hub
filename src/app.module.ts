import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SensorsModule } from './sensors/sensors.module';
import { RdfModule } from './rdf/rdf.module';
import { AssetsModule } from './assets/assets.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsModule } from './dbl/transactions.module';
import { ToolsModule } from './tools/tools.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true, // Make the configuration globally available
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const rawUri = configService.get<string>('MONGO_SERVER') || '';
        const dbName = configService.get<string>('MONGO_DB') || '';

        // Extract and encode password safely
        const encodedUri = rawUri.replace(
          /:(.*?)@/,
          (_, password) => `:${encodeURIComponent(password)}@`,
        );

        return {
          uri: `${encodedUri}/${dbName}`,
        };
      },
      inject: [ConfigService],
    }),
    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     type: 'postgres',
    //     url: config.get<string>('SQL_DB_URL'),
    //     database: config.get<string>('SQL_DB_NAME'),
    //     autoLoadEntities: true,
    //     synchronize: false, // set true only for dev
    //   }),
    // }),
    SensorsModule,
    RdfModule,
    ToolsModule,
    AssetsModule,
    //TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
