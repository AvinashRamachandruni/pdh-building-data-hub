import { Controller, Get, Param, Query } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import {
  ApiDefaultResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SensorDataResponse } from './entities/sensor.entity';
import { DateValidationPipe } from 'src/pipes/DateValidationPipe';

@ApiTags('Sensor data')
@Controller('sensors')
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all sensor IDs',
  })
  @ApiDefaultResponse({
    type: [String],
  })
  async getAllSensorIds() {
    return await this.sensorsService.getAllSensorIds();
  }

  @Get(':sensor_id/records')
  @ApiOperation({
    summary: 'Get sensor data by sensor id and time period',
  })
  @ApiDefaultResponse({
    type: SensorDataResponse,
  })
  @ApiParam({
    name: 'sensor_id',
    example: '11NR00STE-001TRL',
    description: 'BMS sensor id',
  })
  @ApiQuery({
    name: 'start',
    required: false,
    example: new Date(Date.now() - 86400000).toISOString(),
    description: 'Start datetime in ISO format',
    type: Date,
  })
  @ApiQuery({
    name: 'end',
    required: false,
    example: new Date().toISOString(),
    description: 'End datetime in ISO format',
    type: Date,
  })
  @ApiQuery({
    name: 'sample',
    required: false,
    example: 100,
    type: Number,
    description:
      'if empty, returns all the data, otherwise returns a random sample of 100 points between the specified time period.',
  })
  async getRecords(
    @Param('sensor_id') sensor_id: string, // path parameter
    @Query('start', DateValidationPipe) start: Date, // query parameter
    @Query('end', DateValidationPipe) end: Date,
    @Query('sample') sample: number,
  ) {
    return {
      sensor_id: sensor_id,
      start: start,
      end: end,
      result: await this.sensorsService.getRecords(
        sensor_id,
        start,
        end,
        Number(sample),
      ),
    };
  }
}
