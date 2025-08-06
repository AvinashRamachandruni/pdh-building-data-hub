import { Module } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ConfigModule } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { SensorsModule } from './sensors/sensors.module'
import { RdfModule } from './rdf/rdf.module'

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '.env' }),
    MongooseModule.forRoot(
      `${process.env.MONGO_SERVER}/${process.env.MONGO_DB}`
    ),
    SensorsModule,
    RdfModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
