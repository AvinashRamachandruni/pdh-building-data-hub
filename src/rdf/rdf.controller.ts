import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RdfService } from './rdf.service';
import {
  IFCEntity,
  IFCEntityResponse,
  IFCEntityResult,
  IFCEntityListRequest,
} from './entities/rdfentity.entity';

@ApiTags('RDF/IFC Entities')
@Controller('rdf')
export class RdfController {
  constructor(private readonly rdfService: RdfService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new IFC entity' })
  @ApiResponse({
    status: 201,
    description: 'IFC entity created successfully',
    type: IFCEntityResult,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createEntity(
    @Body() createEntityDto: Partial<IFCEntity>,
  ): Promise<IFCEntityResult> {
    try {
      return await this.rdfService.createEntity(createEntityDto);
    } catch (error) {
      throw new HttpException(
        `Failed to create entity: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get list of IFC entities with optional filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of IFC entities retrieved successfully',
    type: IFCEntityResponse,
  })
  @ApiQuery({
    name: 'entity_type',
    required: false,
    description: 'Filter by entity type',
  })
  @ApiQuery({
    name: 'name_filter',
    required: false,
    description: 'Filter by name (partial match)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Limit results',
    type: Number,
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    description: 'Skip results for pagination',
    type: Number,
  })
  async getEntities(
    @Query() query: IFCEntityListRequest,
  ): Promise<IFCEntityResponse> {
    try {
      return await this.rdfService.getEntities(query);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve entities: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific IFC entity by ID' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: 200,
    description: 'IFC entity retrieved successfully',
    type: IFCEntityResult,
  })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async getEntityById(@Param('id') id: string): Promise<IFCEntityResult> {
    try {
      const entity = await this.rdfService.getEntityById(id);
      if (!entity) {
        throw new HttpException('Entity not found', HttpStatus.NOT_FOUND);
      }
      return entity;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to retrieve entity: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('type/:entityType')
  @ApiOperation({ summary: 'Get all entities of a specific IFC type' })
  @ApiParam({
    name: 'entityType',
    description: 'IFC entity type (e.g., IFCSpace, IFCWall)',
  })
  @ApiResponse({
    status: 200,
    description: 'Entities of specified type retrieved successfully',
    type: [IFCEntityResult],
  })
  async getEntitiesByType(
    @Param('entityType') entityType: string,
  ): Promise<IFCEntityResult[]> {
    try {
      return await this.rdfService.getEntitiesByType(entityType);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve entities by type: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing IFC entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: 200,
    description: 'IFC entity updated successfully',
    type: IFCEntityResult,
  })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async updateEntity(
    @Param('id') id: string,
    @Body() updateEntityDto: Partial<IFCEntity>,
  ): Promise<IFCEntityResult> {
    try {
      const updatedEntity = await this.rdfService.updateEntity(
        id,
        updateEntityDto,
      );
      if (!updatedEntity) {
        throw new HttpException('Entity not found', HttpStatus.NOT_FOUND);
      }
      return updatedEntity;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update entity: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an IFC entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({ status: 200, description: 'Entity deleted successfully' })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async deleteEntity(@Param('id') id: string): Promise<{ message: string }> {
    try {
      const deleted = await this.rdfService.deleteEntity(id);
      if (!deleted) {
        throw new HttpException('Entity not found', HttpStatus.NOT_FOUND);
      }
      return { message: 'Entity deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete entity: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple IFC entities in bulk' })
  @ApiResponse({
    status: 201,
    description: 'Bulk entities created successfully',
    type: [IFCEntityResult],
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createBulkEntities(
    @Body() entities: Partial<IFCEntity>[],
  ): Promise<IFCEntityResult[]> {
    try {
      return await this.rdfService.createBulkEntities(entities);
    } catch (error) {
      throw new HttpException(
        `Failed to create bulk entities: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('search/:searchTerm')
  @ApiOperation({ summary: 'Search entities by name or properties' })
  @ApiParam({ name: 'searchTerm', description: 'Search term' })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
    type: [IFCEntityResult],
  })
  async searchEntities(
    @Param('searchTerm') searchTerm: string,
  ): Promise<IFCEntityResult[]> {
    try {
      return await this.rdfService.searchEntities(searchTerm);
    } catch (error) {
      throw new HttpException(
        `Failed to search entities: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
