import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SensorData, SensorDataDocument } from './entities/sensor.entity';

@Injectable()
export class SensorsService {
  readonly logger = new Logger(SensorsService.name);

  constructor(
    @InjectModel(SensorData.name)
    private sensorDataModel: Model<SensorDataDocument>,
    private configService: ConfigService,
  ) {
    this.logger.debug(this.configService.get<string>('MONGO_SERVER'));
  }

  async getRecords(
    sensor_id: string,
    start?: Date,
    end?: Date,
    sample?: number,
  ) {
    const match: any = { sensor_id };
    if (start && end) {
      match.timestamp = { $gt: start, $lt: end };
    } else if (start) {
      match.timestamp = { $gt: start };
    } else if (end) {
      match.timestamp = { $lt: end };
    }
    const pipeline: any[] = [
      { $match: match },
      { $sort: { timestamp: -1 } },
      { $project: { _id: 0, sensor_id: 0 } },
    ];

    if (sample && sample > 0) {
      pipeline.splice(1, 0, { $sample: { size: sample } }); // insert after $match
    }

    return this.sensorDataModel.aggregate(pipeline);
  }

  async getAllSensorIds() {
    return this.sensorDataModel.distinct('sensor_id');
  }
}
