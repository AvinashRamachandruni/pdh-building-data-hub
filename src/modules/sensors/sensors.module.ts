import { Module } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SensorData,
  SensorDataSchema,
  SensorStatus,
  SensorStatusSchema,
} from './entities/sensor.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SensorData.name,
        schema: SensorDataSchema,
      },
      {
        name: SensorStatus.name,
        schema: SensorStatusSchema,
      },
    ]),
  ],
  controllers: [SensorsController],
  providers: [SensorsService],
  exports: [SensorsService],
})
export class SensorsModule {}
