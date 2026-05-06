// pdh.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildMongoUri } from '../config/mongo-uri.util';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      connectionName: 'WILSONTOOLS', // important to name it
      useFactory: async (configService: ConfigService) => ({
        uri: buildMongoUri(
          configService.get<string>('MONGO_SERVER_FOR_TOOLS'),
          configService.get<string>('MONGO_DB_FOR_TOOLS'),
          'pdh-tools',
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
