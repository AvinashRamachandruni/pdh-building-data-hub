import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  PayloadTooLargeException,
  Post,
  Put,
  Req,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { FilesService } from './files.service';
import {
  FileErrorResponseDto,
  FileMetadataDto,
  UpdateFileMetadataDto,
} from './entities/file.entity';
import { FileDocumentMetadata } from './interfaces/file-source-adapter.interface';

type MultipartFilePart = {
  type: 'file';
  fieldname: string;
  filename: string;
  mimetype: string;
  file: { truncated: boolean };
  toBuffer(): Promise<Buffer>;
};

type MultipartFieldPart = {
  type: 'field';
  fieldname: string;
  value: unknown;
};

type MultipartRequest = FastifyRequest & {
  parts(): AsyncIterable<MultipartFilePart | MultipartFieldPart>;
};

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @ApiOperation({ summary: 'Upload a file with its metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'metadata'],
      properties: {
        file: { type: 'string', format: 'binary' },
        metadata: {
          type: 'string',
          description: 'JSON-encoded file metadata',
          example: JSON.stringify({
            fileId: 'floorplan_9f_001',
            title: '9th Floor Plan',
            description: 'Floor plan covering room A0.010 and adjacent spaces',
            documentType: 'floor-plan',
            source: 'pilot-building-documentation',
            linkedEntities: [
              {
                entityId:
                  'http://linkedbuildingdata.net/ifc/resources20201208_005325/space_20821',
                entityType: 'Space',
                relation: 'floor-plan',
                mappingStatus: 'demo-assigned',
              },
            ],
          }),
        },
      },
    },
  })
  @ApiCreatedResponse({ type: FileMetadataDto })
  async create(@Req() request: MultipartRequest): Promise<FileMetadataDto> {
    let file:
      | { filename: string; mediaType: string; buffer: Buffer }
      | undefined;
    let metadata: FileDocumentMetadata | undefined;

    try {
      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname !== 'file' || file) {
            throw new BadRequestException(
              'Send exactly one file part named file',
            );
          }
          let buffer: Buffer;
          try {
            buffer = await part.toBuffer();
          } catch {
            throw new PayloadTooLargeException(
              'File exceeds the 50 MB upload limit',
            );
          }
          if (part.file.truncated) {
            throw new PayloadTooLargeException(
              'File exceeds the 50 MB upload limit',
            );
          }
          file = {
            filename: part.filename,
            mediaType: part.mimetype,
            buffer,
          };
        } else {
          if (
            part.fieldname !== 'metadata' ||
            metadata ||
            typeof part.value !== 'string'
          ) {
            throw new BadRequestException(
              'Send one JSON metadata part named metadata',
            );
          }
          try {
            metadata = JSON.parse(part.value) as FileDocumentMetadata;
          } catch {
            throw new BadRequestException('metadata must contain valid JSON');
          }
        }
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof PayloadTooLargeException
      ) {
        throw error;
      }
      throw new BadRequestException('Invalid multipart upload');
    }

    if (!file || !metadata) {
      throw new BadRequestException(
        'Both file and metadata parts are required',
      );
    }
    return this.filesService.createFile(file, metadata);
  }

  @Get()
  @ApiOperation({ summary: 'List all available files with metadata' })
  @ApiOkResponse({ type: FileMetadataDto, isArray: true })
  async list(): Promise<FileMetadataDto[]> {
    return this.filesService.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file metadata (alias of /files/:id/metadata)' })
  @ApiParam({
    name: 'id',
    description:
      'File identifier (relative path/filename within the storage root)',
  })
  @ApiOkResponse({ type: FileMetadataDto })
  @ApiNotFoundResponse({ type: FileErrorResponseDto })
  async getOne(@Param('id') id: string): Promise<FileMetadataDto> {
    return this.filesService.getMetadata(id);
  }

  @Get(':id/metadata')
  @ApiOperation({ summary: 'Get metadata for a specific file' })
  @ApiParam({
    name: 'id',
    description:
      'File identifier (relative path/filename within the storage root)',
  })
  @ApiOkResponse({ type: FileMetadataDto })
  @ApiNotFoundResponse({ type: FileErrorResponseDto })
  async getMetadata(@Param('id') id: string): Promise<FileMetadataDto> {
    return this.filesService.getMetadata(id);
  }

  @Put(':id/metadata')
  @ApiOperation({ summary: 'Update metadata and asset mappings for a file' })
  @ApiParam({ name: 'id', description: 'File identifier within storage' })
  @ApiBody({ type: UpdateFileMetadataDto })
  @ApiOkResponse({ type: FileMetadataDto })
  @ApiNotFoundResponse({ type: FileErrorResponseDto })
  async updateMetadata(
    @Param('id') id: string,
    @Body() update: UpdateFileMetadataDto,
  ): Promise<FileMetadataDto> {
    return this.filesService.updateMetadata(id, update);
  }

  @Get(':id/content')
  @ApiOperation({
    summary:
      'Stream/download the binary content of a file (images, PDFs, CSVs, IFC, point clouds, ...)',
  })
  @ApiParam({
    name: 'id',
    description:
      'File identifier (relative path/filename within the storage root)',
  })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Binary file stream' })
  @ApiNotFoundResponse({ type: FileErrorResponseDto })
  async getContent(@Param('id') id: string): Promise<StreamableFile> {
    const metadata = await this.filesService.getMetadata(id);
    const stream = await this.filesService.getContentStream(id);

    return new StreamableFile(stream, {
      type: metadata.mediaType,
      disposition: `attachment; filename="${encodeURIComponent(metadata.filename)}"`,
      length: metadata.size,
    });
  }
}
