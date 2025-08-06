import { ApiProperty } from "@nestjs/swagger"
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type SensorDataDocument = HydratedDocument<SensorData>
@Schema({
    collection: 'bms_data',
    toJSON: {
        transform: (doc: SensorDataDocument, ret: Partial<SensorDataDocument>, options: any) => {
            delete ret._id
            delete ret.sensor_id
        }
    }
})
export class SensorData {

    @Prop({ required: true })
    @ApiProperty()
    sensor_id: string

    @Prop({ required: true })
    @ApiProperty()
    value: number

    @Prop({ required: true })
    @ApiProperty()
    timestamp: Date
}

export class SensorDataResult {

    @ApiProperty()
    timestamp: Date

    @ApiProperty()
    value: number
}

export class SensorDataResponse {

    @ApiProperty()
    sensor_id: string

    @ApiProperty()
    start: Date

    @ApiProperty()
    end: Date

    @ApiProperty({
        type: [SensorDataResult]
    })
    result: [SensorDataResult]
}

export const SensorDataSchema = SchemaFactory.createForClass(SensorData) // create a schema for the SensorData class.
