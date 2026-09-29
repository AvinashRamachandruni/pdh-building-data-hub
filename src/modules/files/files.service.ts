import { Inject, Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import {
  FILE_SOURCE_ADAPTER,
  FileMetadata,
  FileMetadataUpdate,
  FileSourceAdapter,
} from './interfaces/file-source-adapter.interface';

/**
 * Domain-facing service for the Files module. It delegates all storage
 * concerns to the injected FileSourceAdapter, keeping the controller and
 * consumers decoupled from the concrete storage backend.
 */
@Injectable()
export class FilesService {
  constructor(
    @Inject(FILE_SOURCE_ADAPTER)
    private readonly fileSourceAdapter: FileSourceAdapter,
  ) {}

  async list(): Promise<FileMetadata[]> {
    return this.fileSourceAdapter.list();
  }

  async getMetadata(id: string): Promise<FileMetadata> {
    return this.fileSourceAdapter.getMetadata(id);
  }

  async updateMetadata(
    id: string,
    update: FileMetadataUpdate,
  ): Promise<FileMetadata> {
    return this.fileSourceAdapter.updateMetadata(id, update);
  }

  async getContentStream(id: string): Promise<Readable> {
    return this.fileSourceAdapter.getContentStream(id);
  }
}
