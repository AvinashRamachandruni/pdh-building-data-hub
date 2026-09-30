import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileDocumentMetadata } from '../interfaces/file-source-adapter.interface';

export class FileLinkedEntityDto {
  @ApiProperty()
  entityId: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  relation: string;

  @ApiProperty()
  mappingStatus: string;
}

export class CreateFileMetadataDto implements FileDocumentMetadata {
  @ApiProperty({ example: 'floorplan_9f_001' })
  fileId: string;

  @ApiPropertyOptional({ example: '9th Floor Plan' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Floor plan covering room A0.010 and adjacent spaces',
  })
  description?: string;

  @ApiPropertyOptional({ example: 'floor-plan' })
  documentType?: string;

  @ApiPropertyOptional({ example: 'pilot-building-documentation' })
  source?: string;

  @ApiPropertyOptional({ type: [FileLinkedEntityDto] })
  linkedEntities?: FileLinkedEntityDto[];
}

/**
 * Stable PDH-facing metadata for a file/object, independent of the
 * underlying storage backend (local filesystem, S3/MinIO, ...).
 */
export class FileMetadataDto {
  @ApiProperty({
    description: 'File identifier (relative path within the storage root)',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'Client-provided stable file identifier',
  })
  fileId?: string;

  @ApiProperty({ description: 'Original filename' })
  filename: string;

  @ApiProperty({
    description: 'MIME type of the file content',
    example: 'application/pdf',
  })
  mediaType: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({
    description: 'Identifier of the storage backend that serves this file',
    example: 'local-fs',
  })
  source: string;

  @ApiPropertyOptional({
    description: 'Absolute path used by the storage backend',
  })
  storagePath?: string;

  @ApiPropertyOptional({ type: CreateFileMetadataDto })
  documentMetadata?: CreateFileMetadataDto;

  @ApiPropertyOptional({ description: 'Related asset identifier, if known' })
  assetId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Related space identifiers',
  })
  spaceIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Related sensor identifiers',
  })
  sensorIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Related asset identifiers',
  })
  assetIds?: string[];

  @ApiPropertyOptional({ description: 'Last modified timestamp (ISO 8601)' })
  timestamp?: string;

  @ApiPropertyOptional({
    description: 'Human-readable description of the file',
  })
  description?: string;

  @ApiPropertyOptional({ description: 'Provenance / origin information' })
  provenance?: string;
}

export class FileErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: 'File not found' })
  message: string;
}

export class UpdateFileMetadataDto {
  @ApiPropertyOptional()
  assetId?: string;

  @ApiPropertyOptional({ type: [String] })
  spaceIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  sensorIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  assetIds?: string[];

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  provenance?: string;
}
