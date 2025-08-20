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

  // async getRecords(
  //   sensor_id: string,
  //   page = 0, // page index, 0-based
  //   pageSize = 100, // number of records per page
  //   start?: Date,
  //   end?: Date,
  // ) {
  //   const match: any = { sensor_id };

  //   if (start && end) {
  //     match.timestamp = { $gte: start, $lte: end };
  //   } else if (start) {
  //     match.timestamp = { $gte: start };
  //   } else if (end) {
  //     match.timestamp = { $lte: end };
  //   }

  //   const pipeline: any[] = [
  //     { $match: match },
  //     { $sort: { timestamp: -1 } }, // or 1 for oldest-first
  //     { $skip: page * pageSize },
  //     { $limit: pageSize },
  //     { $project: { _id: 0, sensor_id: 0 } },
  //   ];

  //   return this.sensorDataModel.aggregate(pipeline);
  // }
}
