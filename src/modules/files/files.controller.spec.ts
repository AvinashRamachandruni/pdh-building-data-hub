import { Test } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

describe('FilesController', () => {
  let controller: FilesController;
  const filesService = {
    list: jest.fn(),
    createFile: jest.fn(),
    getMetadata: jest.fn(),
    updateMetadata: jest.fn(),
    getContentStream: jest.fn(),
    getFilesBySpace: jest.fn(),
    getSpacesForFile: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [FilesController],
      providers: [{ provide: FilesService, useValue: filesService }],
    }).compile();

    controller = moduleRef.get(FilesController);
  });

  it('lists files via the service', async () => {
    filesService.list.mockResolvedValue([{ id: 'a.pdf' }]);
    const result = await controller.list();
    expect(result).toEqual([{ id: 'a.pdf' }]);
  });

  it('accepts a file and JSON metadata multipart upload', async () => {
    const parts = async function* () {
      await Promise.resolve();
      yield {
        type: 'file' as const,
        fieldname: 'file',
        filename: '9th_floor_plan.pdf',
        mimetype: 'application/pdf',
        file: { truncated: false },
        toBuffer: () => Promise.resolve(Buffer.from('uploaded plan')),
      };
      yield {
        type: 'field' as const,
        fieldname: 'metadata',
        value: JSON.stringify({
          fileId: 'floorplan_9f_001',
          title: '9th Floor Plan',
        }),
      };
    };
    filesService.createFile.mockResolvedValue({ id: 'floorplan_9f_001' });

    const result = await controller.create({ parts } as never);

    expect(filesService.createFile).toHaveBeenCalledWith(
      {
        filename: '9th_floor_plan.pdf',
        mediaType: 'application/pdf',
        buffer: Buffer.from('uploaded plan'),
      },
      { fileId: 'floorplan_9f_001', title: '9th Floor Plan' },
    );
    expect(result.id).toBe('floorplan_9f_001');
  });

  it('returns metadata for a file', async () => {
    filesService.getMetadata.mockResolvedValue({
      id: 'a.pdf',
      filename: 'a.pdf',
    });
    const result = await controller.getMetadata('a.pdf');
    expect(result.filename).toBe('a.pdf');
  });

  it('updates metadata for a file', async () => {
    filesService.updateMetadata.mockResolvedValue({
      id: 'a.pdf',
      sensorIds: ['sensor-1'],
    });

    const result = await controller.updateMetadata('a.pdf', {
      sensorIds: ['sensor-1'],
    });

    expect(filesService.updateMetadata).toHaveBeenCalledWith('a.pdf', {
      sensorIds: ['sensor-1'],
    });
    expect(result.sensorIds).toEqual(['sensor-1']);
  });

  it('returns file metadata associated with a building space', async () => {
    filesService.getFilesBySpace.mockResolvedValue({
      spaceId: 'space_16612',
      count: 2,
      files: [
        { id: 'building_manual', fileRole: 'building-common', available: true },
      ],
    });

    const result = await controller.getFilesBySpace('space_16612');

    expect(filesService.getFilesBySpace).toHaveBeenCalledWith('space_16612');
    expect(result.count).toBe(2);
    expect(result.files[0].id).toBe('building_manual');
  });

  it('streams file content with correct headers', async () => {
    filesService.getMetadata.mockResolvedValue({
      id: 'a.pdf',
      filename: 'a.pdf',
      mediaType: 'application/pdf',
      size: 4,
      source: 'local-fs',
    });
    filesService.getContentStream.mockResolvedValue(
      Readable.from(Buffer.from('data')),
    );

    const result = await controller.getContent('a.pdf');
    expect(result).toBeInstanceOf(StreamableFile);
  });
});
