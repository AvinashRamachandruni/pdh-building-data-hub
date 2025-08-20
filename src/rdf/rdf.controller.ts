import {
  Controller,
  Get,
  Put,
  Post,
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
  ApiBody,
} from '@nestjs/swagger';
import { RdfService } from './rdf.service';
import {
  RDFEntity,
  RDFEntityResponse,
  RDFEntityResult,
  RDFEntityListRequest,
} from './entities/rdfentity.entity';

@ApiTags('RDF Data')
@Controller('rdf')
export class RdfController {
  constructor(private readonly rdfService: RdfService) {}
  /*
   * Function to get a list of IFC entities with optional filtering
   * Returns a list of IFC entities based on the provided query parameters
   */
  @Get()
  @ApiOperation({ summary: 'Get list of IFC entities with optional filtering' })
  @ApiResponse({
    status: 200,
    description: 'List of IFC entities retrieved successfully',
    type: RDFEntityResponse,
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
    @Query() query: RDFEntityListRequest,
  ): Promise<RDFEntityResponse> {
    try {
      return await this.rdfService.getEntities(query);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve entities: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /*
   * Function to get a list of IFC entity by ID
   * Returns a single entity based on the provided ID
   * Throws 404 if the entity is not found
   */
  @Get('id/:id')
  @ApiOperation({ summary: 'Get a specific IFC entity by ID' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: 200,
    description: 'IFC entity retrieved successfully',
    type: RDFEntityResult,
  })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async getEntityById(@Param('id') id: string): Promise<RDFEntityResult> {
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

  /*
   * Function to get a list of IFC entity by type
   * Returns a single entity based on the provided type
   */
  @Get('type/:entityType')
  @ApiOperation({ summary: 'Get all entities of a specific IFC type' })
  @ApiResponse({
    status: 200,
    description: 'Entities of specified type retrieved successfully',
    type: [RDFEntityResult],
  })
  async getEntitiesByType(
    @Param('entityType') entityType: string,
  ): Promise<RDFEntityResult[]> {
    try {
      return await this.rdfService.getEntitiesByType(entityType);
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve entities by type: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /*
   * Function to update an existing IFC entity
   * Accepts an ID and a partial entity object to update
   * Returns the updated entity
   * Throws 404 if the entity is not found
   */
  @Put(':id')
  @ApiOperation({ summary: 'Update an existing IFC entity' })
  @ApiParam({ name: 'id', description: 'Entity ID' })
  @ApiResponse({
    status: 200,
    description: 'IFC entity updated successfully',
    type: RDFEntityResult,
  })
  @ApiResponse({ status: 404, description: 'Entity not found' })
  async updateEntity(
    @Param('id') id: string,
    @Body() updateEntityDto: Partial<RDFEntity>,
  ): Promise<RDFEntityResult> {
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
}
