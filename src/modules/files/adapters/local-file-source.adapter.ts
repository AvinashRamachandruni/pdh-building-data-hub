import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { Readable } from 'stream';
import {
  FileMetadata,
  FileMetadataUpdate,
  FileDocumentMetadata,
  FileSourceAdapter,
  UploadedFileContent,
} from '../interfaces/file-source-adapter.interface';

// Minimal, dependency-free MIME lookup covering the file types this
// prototype targets (images, PDFs, CSVs, IFC, point clouds).
const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.ifc': 'application/x-step',
  '.las': 'application/vnd.las',
  '.laz': 'application/vnd.laz',
  '.e57': 'application/octet-stream',
};

function resolveMediaType(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function isExistingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'EEXIST'
  );
}

/**
 * Local filesystem implementation of FileSourceAdapter. Files are served
 * strictly from a single configurable root directory; a substitute backend
 * (S3/MinIO) can implement the same interface without any controller or
 * consumer changes.
 */
@Injectable()
export class LocalFileSourceAdapter implements FileSourceAdapter {
  private readonly logger = new Logger(LocalFileSourceAdapter.name);
  private readonly storageRoot: string;
  private readonly sourceName = 'local-fs';

  constructor(private readonly configService: ConfigService) {
    const configuredRoot = this.configService.get<string>('FILE_STORAGE_ROOT');
    if (!configuredRoot) {
      throw new Error(
        'FILE_STORAGE_ROOT environment variable is not configured',
      );
    }
    this.storageRoot = path.resolve(configuredRoot);
    this.logger.log(`File storage root: ${this.storageRoot}`);
  }

  async list(): Promise<FileMetadata[]> {
    const entries = await fsPromises.readdir(this.storageRoot, {
      withFileTypes: true,
    });
    const files = entries.filter((entry) => entry.isFile());
    return Promise.all(files.map((entry) => this.buildMetadata(entry.name)));
  }

  async getMetadata(id: string): Promise<FileMetadata> {
    return this.buildMetadata(id);
  }

  async createFile(
    file: UploadedFileContent,
    metadata: FileDocumentMetadata,
  ): Promise<FileMetadata> {
    this.validateDocumentMetadata(metadata);
    if (!file.buffer.length) {
      throw new BadRequestException('Uploaded file must not be empty');
    }

    const id = metadata.fileId.trim();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      throw new BadRequestException(
        'fileId may contain only letters, numbers, underscores, and hyphens',
      );
    }

    const filename = path.basename(file.filename.replace(/\\/g, '/'));
    if (!filename || filename === '.' || filename === '..') {
      throw new BadRequestException('Invalid uploaded filename');
    }

    const filePath = this.resolveSafePath(id);
    const mediaType = file.mediaType || resolveMediaType(filename);
    const metadataDirectory = path.join(this.storageRoot, '.pdh-metadata');
    const storedMetadata: Partial<FileMetadata> = {
      fileId: id,
      filename,
      mediaType,
      size: file.buffer.length,
      storagePath: filePath,
      documentMetadata: { ...metadata, fileId: id },
    };

    await fsPromises.mkdir(this.storageRoot, { recursive: true });
    await fsPromises.mkdir(metadataDirectory, { recursive: true });
    try {
      await fsPromises.writeFile(filePath, file.buffer, { flag: 'wx' });
    } catch (error) {
      if (isExistingFileError(error)) {
        throw new ConflictException(`File ${id} already exists`);
      }
      throw error;
    }

    try {
      await fsPromises.writeFile(
        this.metadataPath(id, metadataDirectory),
        JSON.stringify(storedMetadata),
        'utf8',
      );
    } catch (error) {
      await fsPromises.rm(filePath, { force: true });
      throw error;
    }

    return {
      id,
      ...storedMetadata,
      source: this.sourceName,
    } as FileMetadata;
  }

  async updateMetadata(
    id: string,
    update: FileMetadataUpdate,
  ): Promise<FileMetadata> {
    const current = await this.buildMetadata(id);
    this.validateMetadataUpdate(update);

    const updated = { ...current, ...update };
    const metadataDirectory = path.join(this.storageRoot, '.pdh-metadata');
    await fsPromises.mkdir(metadataDirectory, { recursive: true });
    const storedUpdate: Partial<FileMetadata> = {
      ...(await this.readStoredMetadata(id)),
      assetId: updated.assetId,
      spaceIds: updated.spaceIds,
      sensorIds: updated.sensorIds,
      assetIds: updated.assetIds,
      description: updated.description,
      provenance: updated.provenance,
    };
    await fsPromises.writeFile(
      this.metadataPath(id, metadataDirectory),
      JSON.stringify(storedUpdate),
      'utf8',
    );
    return updated;
  }

  async getContentStream(id: string): Promise<Readable> {
    const filePath = this.resolveSafePath(id);
    await this.ensureFileExists(filePath);
    return fs.createReadStream(filePath);
  }

  /**
   * Resolves an id (relative filename/path) to an absolute path inside
   * storageRoot, rejecting any attempt to escape it (path traversal).
   */
  private resolveSafePath(id: string): string {
    if (!id || id.includes('\0')) {
      throw new BadRequestException('Invalid file identifier');
    }

    const candidate = path.resolve(this.storageRoot, id);
    const relative = path.relative(this.storageRoot, candidate);

    if (
      relative === '' ||
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    ) {
      throw new BadRequestException('Invalid file identifier');
    }

    return candidate;
  }

  private async buildMetadata(id: string): Promise<FileMetadata> {
    const filePath = this.resolveSafePath(id);
    const stats = await this.ensureFileExists(filePath);

    const metadata: FileMetadata = {
      id,
      filename: path.basename(filePath),
      mediaType: resolveMediaType(filePath),
      size: stats.size,
      source: this.sourceName,
      timestamp: stats.mtime.toISOString(),
    };
    const stored = await this.readStoredMetadata(id);
    return { ...metadata, ...stored };
  }

  private metadataPath(
    id: string,
    directory = path.join(this.storageRoot, '.pdh-metadata'),
  ): string {
    const digest = createHash('sha256').update(id).digest('hex');
    return path.join(directory, `${digest}.json`);
  }

  private async readStoredMetadata(id: string): Promise<Partial<FileMetadata>> {
    try {
      const contents = await fsPromises.readFile(this.metadataPath(id), 'utf8');
      return JSON.parse(contents) as Partial<FileMetadata>;
    } catch (error) {
      if (isMissingFileError(error)) {
        return {};
      }
      throw error;
    }
  }

  private validateDocumentMetadata(metadata: FileDocumentMetadata): void {
    if (
      !metadata ||
      typeof metadata.fileId !== 'string' ||
      !metadata.fileId.trim()
    ) {
      throw new BadRequestException('metadata.fileId is required');
    }
    for (const field of [
      'title',
      'description',
      'documentType',
      'source',
    ] as const) {
      const value = metadata[field];
      if (value !== undefined && typeof value !== 'string') {
        throw new BadRequestException(`metadata.${field} must be a string`);
      }
    }
    if (metadata.linkedEntities !== undefined) {
      if (!Array.isArray(metadata.linkedEntities)) {
        throw new BadRequestException(
          'metadata.linkedEntities must be an array',
        );
      }
      for (const entity of metadata.linkedEntities) {
        if (
          !entity ||
          ['entityId', 'entityType', 'relation', 'mappingStatus'].some(
            (field) =>
              typeof entity[field] !== 'string' || !entity[field].trim(),
          )
        ) {
          throw new BadRequestException(
            'Each linked entity requires entityId, entityType, relation, and mappingStatus strings',
          );
        }
      }
    }
  }

  private validateMetadataUpdate(update: FileMetadataUpdate): void {
    for (const field of ['assetId', 'description', 'provenance'] as const) {
      const value = update[field];
      if (value !== undefined && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a string`);
      }
    }
    for (const field of ['spaceIds', 'sensorIds', 'assetIds'] as const) {
      const values = update[field];
      if (
        values !== undefined &&
        (!Array.isArray(values) ||
          values.some((value) => typeof value !== 'string'))
      ) {
        throw new BadRequestException(`${field} must be an array of strings`);
      }
    }
  }

  private async ensureFileExists(filePath: string): Promise<fs.Stats> {
    try {
      const stats = await fsPromises.stat(filePath);
      if (!stats.isFile()) {
        throw new NotFoundException('File not found');
      }
      return stats;
    } catch (error) {
      if (isMissingFileError(error)) {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }
}
