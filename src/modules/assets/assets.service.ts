import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SensorsService } from '../sensors/sensors.service';
import { RdfService } from '../rdf/rdf.service';

export interface AssetResponse {
  assetId: string;
  type: 'Sensor' | 'Space';
  data: Record<string, any>;
  context: {
    space?: {
      id: string;
      name: string;
    };
    sensors?: Array<{
      id: string;
      name: string;
      lastValue?: number;
    }>;
  };
  message?: string;
}

@Injectable()
export class AssetsService {
  readonly logger = new Logger(AssetsService.name);

  constructor(
    private configService: ConfigService,
    private sensorsService: SensorsService,
    private rdfService: RdfService,
  ) {
    this.logger.debug(this.configService.get<string>('MONGO_SERVER'));
  }

  private extractType(sensorId: string): string {
    if (sensorId.includes('TEMP')) return 'Temperature';
    if (sensorId.includes('CO2')) return 'CO2';
    if (sensorId.includes('LUM')) return 'Light';
    return 'Unknown';
  }

  async getSensorStatus(
    sensorId: string,
    include?: string,
  ): Promise<AssetResponse> {
    this.logger.debug(
      `Fetching sensor status for sensor ID: ${sensorId}, include: ${include}`,
    );

    try {
      this.logger.debug('Querying MongoDB for sensor data');

      const latestRecord = await this.sensorsService.getLatestRecord(sensorId);

      if (!latestRecord) {
        return {
          assetId: sensorId,
          type: 'Sensor',
          data: {},
          context: {},
          message: 'Sensor not found',
        };
      }

      const response: AssetResponse = {
        assetId: sensorId,
        type: 'Sensor',
        data: {
          value: latestRecord?.value,
          status: 'active',
          sensorType: this.extractType(sensorId),
        },
        context: {},
      };

      if (latestRecord?.unit) {
        response.data.unit = latestRecord.unit;
      }

      if (include === 'space') {
        this.logger.debug('Querying RDF mapping layer');

        const spaceMapping =
          await this.rdfService.getSensorSpaceMapping(sensorId);

        if (spaceMapping) {
          response.context.space = {
            id: spaceMapping.spaceId,
            name: spaceMapping.spaceName,
          };
        }
      }

      return response;
    } catch (error) {
      this.logger.error(`Error fetching sensor status for ${sensorId}:`, error);
      return {
        assetId: sensorId,
        type: 'Sensor',
        data: {},
        context: {},
        message: 'Error fetching sensor data',
      };
    }
  }

  async getSpaceStatus(
    spaceId: string,
    include?: string,
  ): Promise<AssetResponse> {
    this.logger.debug(
      `Fetching space status for space ID: ${spaceId}, include: ${include}`,
    );

    try {
      this.logger.debug('Querying RDF for space info');

      const spaceInfo = await this.rdfService.getEntityByGlobalId(spaceId);

      if (!spaceInfo) {
        return {
          assetId: spaceId,
          type: 'Space',
          data: {},
          context: {},
          message: 'Space not found',
        };
      }

      const response: AssetResponse = {
        assetId: spaceId,
        type: 'Space',
        data: {
          status: 'monitored',
        },
        context: {},
      };

      if (include === 'sensors') {
        this.logger.debug('Querying RDF mapping for sensors');

        const sensorsMappings =
          await this.rdfService.getSpaceSensorsMappings(spaceId);

        if (sensorsMappings.length === 0) {
          response.context.sensors = [];
          return response;
        }

        this.logger.debug('Querying MongoDB for sensor values');

        const sensorsWithData = await Promise.all(
          sensorsMappings.map(async (mapping) => {
            try {
              const latestRecord = await this.sensorsService.getLatestRecord(
                mapping.sensorId,
              );

              return {
                id: mapping.sensorId,
                name: mapping.sensorName,
                lastValue: latestRecord?.value,
              };
            } catch (error) {
              this.logger.warn(
                `Failed to get records for sensor ${mapping.sensorId}:`,
                error,
              );
              return {
                id: mapping.sensorId,
                name: mapping.sensorName,
              };
            }
          }),
        );

        response.context.sensors = sensorsWithData;
      }

      return response;
    } catch (error) {
      this.logger.error(`Error fetching space status for ${spaceId}:`, error);
      return {
        assetId: spaceId,
        type: 'Space',
        data: {},
        context: {},
        message: 'Error fetching space data',
      };
    }
  }
}
