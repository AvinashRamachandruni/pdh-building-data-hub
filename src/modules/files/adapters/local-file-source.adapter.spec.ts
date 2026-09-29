import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { LocalFileSourceAdapter } from './local-file-source.adapter';

describe('LocalFileSourceAdapter', () => {
  const testRoot = path.resolve(__dirname, '__test-storage__');
  let adapter: LocalFileSourceAdapter;

  beforeAll(async () => {
    await fsPromises.mkdir(testRoot, { recursive: true });
    await fsPromises.writeFile(
      path.join(testRoot, 'sample.pdf'),
      'dummy content',
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalFileSourceAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'FILE_STORAGE_ROOT' ? testRoot : undefined,
          },
        },
      ],
    }).compile();

    adapter = moduleRef.get(LocalFileSourceAdapter);
  });

  afterAll(async () => {
    await fsPromises.rm(testRoot, { recursive: true, force: true });
  });

  it('lists files with metadata', async () => {
    const files = await adapter.list();
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toHaveProperty('mediaType');
    expect(files[0]).toHaveProperty('source', 'local-fs');
  });

  it('returns metadata for a known file', async () => {
    const meta = await adapter.getMetadata('sample.pdf');
    expect(meta.filename).toBe('sample.pdf');
    expect(meta.mediaType).toBe('application/pdf');
    expect(meta.source).toBe('local-fs');
    expect(typeof meta.size).toBe('number');
  });

  it('persists file-to-asset mappings in metadata', async () => {
    await adapter.updateMetadata('sample.pdf', {
      spaceIds: ['http://example.org/Space-001'],
      sensorIds: ['sensor-1'],
      assetIds: ['asset-1'],
    });
    await adapter.updateMetadata('sample.pdf', { description: 'Floor plan' });

    await expect(adapter.getMetadata('sample.pdf')).resolves.toMatchObject({
      spaceIds: ['http://example.org/Space-001'],
      sensorIds: ['sensor-1'],
      assetIds: ['asset-1'],
      description: 'Floor plan',
    });
  });

  it('streams file content', async () => {
    const stream = await adapter.getContentStream('sample.pdf');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    expect(Buffer.concat(chunks).toString()).toBe('dummy content');
  });

  it('rejects path traversal attempts', async () => {
    await expect(adapter.getMetadata('../outside.txt')).rejects.toThrow(
      BadRequestException,
    );
    await expect(adapter.getMetadata('..\\outside.txt')).rejects.toThrow(
      BadRequestException,
    );
    await expect(adapter.getMetadata('/etc/passwd')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException for a missing file', async () => {
    await expect(adapter.getMetadata('does-not-exist.pdf')).rejects.toThrow(
      NotFoundException,
    );
    await expect(
      adapter.getContentStream('does-not-exist.pdf'),
    ).rejects.toThrow(NotFoundException);
  });
});
