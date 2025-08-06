import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SensorData, SensorDataDocument } from './entities/sensor.entity';

@Injectable()
export class SensorsService {
  readonly logger = new Logger(SensorsService.name);

  constructor(
    @InjectModel(SensorData.name)
    private sensorDataModel: Model<SensorDataDocument>,
  ) {
    this.logger.debug(process.env.MONGO_SERVER);
  }

  async getRecords(sensor_id: string, start: Date, end: Date, sample: number) {
    // this.logger.debug(sample)
    // const records = await this.sensorDataModel
    //   .find({
    //     sensor_id: id,
    //     timestamp: { $gt: start, $lt: end }
    //   })
    // .skip(skip ? skip : 0)
    // .limit(limit)

    // TODO: MQL for count + result
    const records = this.sensorDataModel.aggregate([
      {
        $match: {
          sensor_id: sensor_id,
          timestamp: { $gt: start, $lt: end },
        },
      },
      {
        $sample: { size: sample ? sample : Number.MAX_VALUE },
      },
      {
        $sort: { timestamp: -1 },
      },
      { $project: { _id: 0, sensor_id: 0 } }, // Delete id and sensor_id. we
      // only need timestamp and value to plot
    ]);
    return records;
  }
}
