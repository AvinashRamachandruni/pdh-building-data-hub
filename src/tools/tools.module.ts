// pdh.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      connectionName: 'WILSONTOOLS', // important to name it
      useFactory: async (configService: ConfigService) => ({
        uri: `mongodb://${configService.get<string>('MONGO_SERVER_FOR_TOOLS')}/${configService.get<string>('MONGO_DB_FOR_TOOLS')}`,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ToolsController],
  providers: [ToolsService],
})
export class ToolsModule {}
