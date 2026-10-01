import { ConfigService } from '@nestjs/config';
import { FilesService } from '../files/files.service';
import { RdfService } from '../rdf/rdf.service';
import { SensorsService } from '../sensors/sensors.service';
import { AssetsService } from './assets.service';

describe('AssetsService IFC space context', () => {
  it('returns BOT mappings and latest historical observations for every sensor', async () => {
    const rdfService = {
      resolveBotSpaceFromIfcSpace: jest
        .fn()
        .mockResolvedValue('https://building.example/bot/space-1'),
      getSpaceSensorLinksByBotSpace: jest.fn().mockResolvedValue([
        {
          rdfSensorId: 'https://building.example/sensor/1',
          measurementSensorId: 'BMS-1',
        },
      ]),
    };
    const timestamp = new Date('2021-06-01T12:00:00.000Z');
    const sensorsService = {
      getLatestRecord: jest.fn().mockResolvedValue({
        timestamp,
        value: 22.5,
      }),
    };
    const fileResponse = {
      spaceId: 'IfcSpace_84963',
      count: 1,
      files: [
        {
          id: 'floorplan-1',
          fileRole: 'space-associated',
          available: true,
        },
      ],
    };
    const filesService = {
      getFilesByBotSpace: jest.fn().mockResolvedValue(fileResponse),
    };
    const service = new AssetsService(
      { get: jest.fn() } as unknown as ConfigService,
      sensorsService as unknown as SensorsService,
      rdfService as unknown as RdfService,
      filesService as unknown as FilesService,
    );

    const context = await service.getSpaceContextByIfcSpace('IfcSpace_84963');

    expect(context).toEqual({
      ifcSpaceId: 'IfcSpace_84963',
      botSpaceId: 'https://building.example/bot/space-1',
      sensors: [
        {
          rdfSensorId: 'https://building.example/sensor/1',
          measurementSensorId: 'BMS-1',
          latestHistoricalObservation: { timestamp, value: 22.5 },
        },
      ],
      files: fileResponse.files,
    });
    expect(sensorsService.getLatestRecord).toHaveBeenCalledWith('BMS-1');
    expect(filesService.getFilesByBotSpace).toHaveBeenCalledWith(
      'https://building.example/bot/space-1',
      'IfcSpace_84963',
    );
  });

  it('returns empty sensor and file results for an unmapped IFC space', async () => {
    const rdfService = {
      resolveBotSpaceFromIfcSpace: jest.fn().mockResolvedValue(null),
    };
    const filesService = { getFilesByBotSpace: jest.fn() };
    const sensorsService = { getLatestRecord: jest.fn() };
    const service = new AssetsService(
      { get: jest.fn() } as unknown as ConfigService,
      sensorsService as unknown as SensorsService,
      rdfService as unknown as RdfService,
      filesService as unknown as FilesService,
    );

    await expect(
      service.getSpaceContextByIfcSpace('IfcSpace_missing'),
    ).resolves.toEqual({
      ifcSpaceId: 'IfcSpace_missing',
      botSpaceId: null,
      sensors: [],
      files: [],
    });
    expect(filesService.getFilesByBotSpace).not.toHaveBeenCalled();
    expect(sensorsService.getLatestRecord).not.toHaveBeenCalled();
  });
});