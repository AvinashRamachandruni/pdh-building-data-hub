import { Test } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

describe('FilesController', () => {
  let controller: FilesController;
  const filesService = {
    list: jest.fn(),
    getMetadata: jest.fn(),
    getContentStream: jest.fn(),
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

  it('returns metadata for a file', async () => {
    filesService.getMetadata.mockResolvedValue({
      id: 'a.pdf',
      filename: 'a.pdf',
    });
    const result = await controller.getMetadata('a.pdf');
    expect(result.filename).toBe('a.pdf');
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
