import { Controller, Get, Param } from '@nestjs/common';
import { AssetsService } from './assets.service';
import {
  ApiDefaultResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('sensor/:sensorId/status')
  @ApiOperation({
    summary: 'Get sensor status by sensor ID',
  })
  @ApiDefaultResponse({
    description: 'Sensor status information',
  })
  @ApiParam({
    name: 'sensorId',
    example: '11NR00STE-001TRL',
    description: 'Sensor ID',
  })
  async getSensorStatus(@Param('sensorId') sensorId: string) {
    return this.assetsService.getSensorStatus(sensorId);
  }

  @Get('space/:spaceId/status')
  @ApiOperation({
    summary: 'Get space status by space ID',
  })
  @ApiDefaultResponse({
    description: 'Space status information',
  })
  @ApiParam({
    name: 'spaceId',
    example: 'SPACE-001',
    description: 'Space ID',
  })
  async getSpaceStatus(@Param('spaceId') spaceId: string) {
    return this.assetsService.getSpaceStatus(spaceId);
  }
}
