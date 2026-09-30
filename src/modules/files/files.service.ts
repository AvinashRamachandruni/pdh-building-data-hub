import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { RdfService } from '../rdf/rdf.service';
import {
  FILE_SOURCE_ADAPTER,
  FileDocumentMetadata,
  FileMetadata,
  FileMetadataUpdate,
  FileSourceAdapter,
  UploadedFileContent,
} from './interfaces/file-source-adapter.interface';
import {
  SpaceFilesResponseDto,
  SpaceMappedFileDto,
} from './entities/file.entity';

/**
 * Domain-facing service for the Files module. It delegates all storage
 * concerns to the injected FileSourceAdapter, keeping the controller and
 * consumers decoupled from the concrete storage backend.
 */
@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @Inject(FILE_SOURCE_ADAPTER)
    private readonly fileSourceAdapter: FileSourceAdapter,
    private readonly rdfService: RdfService,
  ) {}

  async list(): Promise<FileMetadata[]> {
    return this.fileSourceAdapter.list();
  }

  async createFile(
    file: UploadedFileContent,
    metadata: FileDocumentMetadata,
  ): Promise<FileMetadata> {
    return this.fileSourceAdapter.createFile(file, metadata);
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

  async getFilesBySpace(spaceId: string): Promise<SpaceFilesResponseDto> {
    const mappings = await this.rdfService.getSpaceFileMappings(spaceId);

    const files = await Promise.all(
      mappings.map(async (mapping): Promise<SpaceMappedFileDto> => {
        try {
          const metadata = await this.fileSourceAdapter.getMetadata(mapping.fileId);
          return {
            id: metadata.id,
            fileRole: mapping.fileRole,
            mappingMethod: mapping.mappingMethod,
            mappingStatus: mapping.mappingStatus,
            available: true,
            filename: metadata.filename,
            mediaType: metadata.mediaType,
            size: metadata.size,
            source: metadata.source,
            storagePath: metadata.storagePath,
            timestamp: metadata.timestamp,
            metadata,
          };
        } catch (error) {
          const message =
            error instanceof NotFoundException
              ? 'Mapped file is not available in the configured file source'
              : error instanceof Error
                ? error.message
                : 'Mapped file is not available in the configured file source';

          this.logger.warn(
            `Skipping stale mapped file for space ${spaceId}: ${mapping.fileId}`,
            message,
          );

          return {
            id: mapping.fileId,
            fileRole: mapping.fileRole,
            mappingMethod: mapping.mappingMethod,
            mappingStatus: mapping.mappingStatus,
            available: false,
            error: message,
          };
        }
      }),
    );

    return {
      spaceId,
      count: files.length,
      files,
    };
  }

  async getSpacesForFile(fileId: string): Promise<{ fileId: string; count: number; spaces: string[] }> {
    const spaces = await this.rdfService.getSpacesForFile(fileId);
    return {
      fileId,
      count: spaces.length,
      spaces,
    };
  }
}
