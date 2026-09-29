import { Body, Controller, Get, Param, Put, StreamableFile } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import {
  FileErrorResponseDto,
  FileMetadataDto,
  UpdateFileMetadataDto,
} from './entities/file.entity';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

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
