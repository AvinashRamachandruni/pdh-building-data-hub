import { Readable } from 'stream';

/**
 * PDH-facing shape describing a binary file regardless of which backend
 * (local filesystem, S3/MinIO, ...) actually stores the bytes.
 */
export interface FileMetadata {
  id: string;
  filename: string;
  mediaType: string;
  size: number;
  source: string;
  assetId?: string;
  spaceIds?: string[];
  sensorIds?: string[];
  assetIds?: string[];
  timestamp?: string;
  description?: string;
  provenance?: string;
}

export type FileMetadataUpdate = Pick<
  FileMetadata,
  | 'assetId'
  | 'spaceIds'
  | 'sensorIds'
  | 'assetIds'
  | 'description'
  | 'provenance'
>;

/**
 * Reusable contract for file/object storage backends. Controllers and
 * services depend only on this interface, so the backend (local disk today,
 * S3/MinIO or a point-cloud repository tomorrow) can be swapped by changing
 * a single provider binding in FilesModule.
 */
export interface FileSourceAdapter {
  list(): Promise<FileMetadata[]>;
  getMetadata(id: string): Promise<FileMetadata>;
  updateMetadata(id: string, update: FileMetadataUpdate): Promise<FileMetadata>;
  getContentStream(id: string): Promise<Readable>;
}

export const FILE_SOURCE_ADAPTER = 'FILE_SOURCE_ADAPTER';
