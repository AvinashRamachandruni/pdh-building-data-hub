import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { AssetsService } from './assets.service';
import {
  ApiDefaultResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

export interface AssetResponse {
  assetId: string;
  type: 'Sensor' | 'Space';
  data: Record<string, any>;
  context?: {
    space?: {
      id: string;
      name: string;
    };
    sensors?: Array<{
      id: string;
      name: string;
    }>;
  };
  message?: string;
}

@ApiTags('Assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('sensor/:sensorId/status')
  @ApiOperation({
    summary: 'Get sensor status by sensor ID',
  })
  @ApiQuery({
    name: 'include',
    required: false,
    description: 'Include mapping information: space',
    example: 'space',
  })
  @ApiDefaultResponse({
    description: 'Sensor status information',
  })
  @ApiParam({
    name: 'sensorId',
    example: '11NR00STE-001TRL',
    description: 'Sensor ID',
  })
  async getSensorStatus(
    @Param('sensorId') sensorId: string,
    @Query('include') include?: string,
  ): Promise<AssetResponse> {
    return this.assetsService.getSensorStatus(sensorId, include);
  }

  @Get('space/:spaceId/status')
  @ApiOperation({
    summary: 'Get space status by space ID',
  })
  @ApiQuery({
    name: 'include',
    required: false,
    description: 'Include mapping information: sensors',
    example: 'sensors',
  })
  @ApiDefaultResponse({
    description: 'Space status information',
  })
  @ApiParam({
    name: 'spaceId',
    example: 'SPACE-001',
    description: 'Space ID',
  })
  async getSpaceStatus(
    @Param('spaceId') spaceId: string,
    @Query('include') include?: string,
  ): Promise<AssetResponse> {
    return this.assetsService.getSpaceStatus(spaceId, include);
  }

  @Get('space-context')
  @ApiOperation({
    summary: 'Get sensors and files mapped to an IFC space',
  })
  @ApiQuery({
    name: 'ifcSpaceId',
    required: true,
    description: 'Local IFC space identifier or full IFC space URI',
  })
  async getSpaceContextByIfcSpace(@Query('ifcSpaceId') ifcSpaceId?: string) {
    if (!ifcSpaceId?.trim()) {
      throw new BadRequestException('ifcSpaceId is required');
    }
    return this.assetsService.getSpaceContextByIfcSpace(ifcSpaceId);
  }
}
