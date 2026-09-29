import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import {
  FileMetadata,
  FileSourceAdapter,
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

    return {
      id,
      filename: path.basename(filePath),
      mediaType: resolveMediaType(filePath),
      size: stats.size,
      source: this.sourceName,
      timestamp: stats.mtime.toISOString(),
    };
  }

  private async ensureFileExists(filePath: string): Promise<fs.Stats> {
    try {
      const stats = await fsPromises.stat(filePath);
      if (!stats.isFile()) {
        throw new NotFoundException('File not found');
      }
      return stats;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }
}
