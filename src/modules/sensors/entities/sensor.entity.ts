import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SensorDataDocument = HydratedDocument<SensorData>;
@Schema({
  collection: 'bms_data',
  toJSON: {
    transform: (
      doc: SensorDataDocument,
      ret: Partial<SensorDataDocument>,
      options: any,
    ) => {
      delete ret._id;
      delete ret.sensor_id;
    },
  },
})
export class SensorData {
  @Prop({ required: true, index: true })
  @ApiProperty()
  sensor_id: string;

  @Prop({ required: true, type: Number })
  @ApiProperty()
  value: number;

  @Prop({ required: true, type: Date, index: true })
  @ApiProperty()
  timestamp: Date;
}

@Schema({ collection: 'sensor_status' })
export class SensorStatus {
  @Prop({ required: true, unique: true, index: true })
  @ApiProperty()
  sensor_id: string;

  @Prop({ required: true, type: Boolean })
  @ApiProperty()
  active: boolean;

  @Prop({ required: true, type: Date, default: Date.now })
  @ApiProperty()
  updated_at: Date;
}

export class SensorDataResult {
  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  value: number;
}

export class SensorDataResponse {
  @ApiProperty()
  sensor_id: string;

  @ApiProperty()
  start_date: Date;

  @ApiProperty()
  end_date: Date;

  @ApiProperty({
    type: [SensorDataResult],
  })
  result: [SensorDataResult];
}

export const SensorDataSchema = SchemaFactory.createForClass(SensorData); // create a schema for the SensorData class.
export const SensorStatusSchema = SchemaFactory.createForClass(SensorStatus);

export class SetSensorStatusRequest {
  @ApiProperty({ description: 'Whether the sensor is active' })
  active: boolean;
}
