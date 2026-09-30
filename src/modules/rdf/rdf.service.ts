import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createHash } from 'node:crypto';
import { RedisCacheService } from '../cache/redis-cache.service';
import {
  RDFEntity,
  RDFEntityResponse,
  RDFEntityResult,
  RDFEntityListRequest,
} from './entities/rdfentity.entity';

interface SPARQLResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Array<Record<string, { type: string; value: string }>>;
  };
}

@Injectable()
export class RdfService {
  private readonly logger = new Logger(RdfService.name);
  private readonly rdfServerUrl: string;
  private readonly mappingGraphUri: string;
  private readonly fileMappingGraphUri: string;
  private readonly entityCacheTtlSeconds: number;
  private readonly propsNamespace: string;
  private readonly instanceNamespace: string;

  constructor(
    private configService: ConfigService,
    private readonly cache: RedisCacheService,
  ) {
    const rdfServerUrl = this.configService.get<string>('RDF_SERVER');
    if (!rdfServerUrl) {
      throw new Error('RDF_SERVER environment variable is not configured');
    }
    this.rdfServerUrl = rdfServerUrl;
    const ttl = configService.get<string>('REDIS_ENTITY_TTL_SECONDS') ?? '300';
    if (!/^[1-9]\d*$/.test(ttl) || !Number.isSafeInteger(Number(ttl))) {
      throw new Error('REDIS_ENTITY_TTL_SECONDS must be a positive integer');
    }
    this.entityCacheTtlSeconds = Number(ttl);
    this.mappingGraphUri =
      this.configService.get<string>('GRAPHDB_MAPPING_GRAPH') ||
      'http://ams.validation/graph/mapping-layer';
    this.fileMappingGraphUri =
      this.configService.get<string>('FILE_MAPPING_GRAPH') ||
      this.mappingGraphUri ||
      'https://pdh.example/graph/file-mappings';
    this.propsNamespace =
      this.configService.get<string>('RDF_PROPS_NAMESPACE') ||
      'https://pdh.example/ontology/props#';
    this.instanceNamespace =
      this.configService.get<string>('RDF_INSTANCE_NAMESPACE') ||
      'https://pdh.example/instance/';
    this.logger.log(`RDF Server URL: ${this.rdfServerUrl}`);
    this.logger.log(`RDF mapping graph: ${this.mappingGraphUri}`);
    this.logger.log(`File mapping graph: ${this.fileMappingGraphUri}`);
    this.logger.log(`RDF props namespace: ${this.propsNamespace}`);
  }

  /**
   * Execute SPARQL query against RDF repository
   */
  private async executeSparqlQuery(query: string): Promise<SPARQLResult> {
    try {
      // Make sure query has real line breaks, not "\n"
      const sparqlQuery = query.replace(/\\n/g, '\n');

      const response: AxiosResponse<SPARQLResult> = await axios.post(
        this.rdfServerUrl,
        sparqlQuery, // send raw text
        {
          headers: {
            'Content-Type': 'application/sparql-query',
            Accept: 'application/sparql-results+json',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('SPARQL query failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
        config: error.config,
      });
      throw new Error(`Failed to execute SPARQL query: ${error.message}`);
    }
  }

  private async executeSparqlUpdate(update: string): Promise<void> {
    try {
      const statementsUrl = `${this.rdfServerUrl.replace(/\/+$/, '')}/statements`;
      await axios.post(statementsUrl, update, {
        headers: { 'Content-Type': 'application/sparql-update' },
      });
    } catch (error: any) {
      this.logger.error('SPARQL update failed:', {
        message: error.message,
        status: error.response?.status,
      });
      throw new Error(`Failed to execute SPARQL update: ${error.message}`);
    }
  }

  async createSensorSpaceMapping(sensorId: string, spaceId: string) {
    const normalizedSensorId = sensorId?.trim();
    const normalizedSpaceId = this.normalizeIri(spaceId);
    if (!normalizedSensorId) {
      throw new BadRequestException('sensorId is required');
    }

    const sensorSubject = `urn:pdh:sensor:${encodeURIComponent(normalizedSensorId)}`;
    const sensorIdLiteral = JSON.stringify(normalizedSensorId);
    const update = `
      PREFIX : <http://ams.validation/ontology#>
      PREFIX asset: <http://example.org/asset#>
      DELETE {
        GRAPH <${this.mappingGraphUri}> { ?sensor ?locatedInPredicate ?existingSpace . }
      }
      INSERT {
        GRAPH <${this.mappingGraphUri}> {
          <${sensorSubject}> asset:sensorId ${sensorIdLiteral} ;
            asset:locatedIn <${normalizedSpaceId}> .
        }
      }
      WHERE {
        OPTIONAL {
          GRAPH <${this.mappingGraphUri}> {
            VALUES ?sensorIdPredicate { asset:sensorId :sensorId }
            VALUES ?locatedInPredicate { asset:locatedIn :locatedIn }
            ?sensor ?sensorIdPredicate ${sensorIdLiteral} ;
              ?locatedInPredicate ?existingSpace .
          }
        }
      }
    `;

    await this.executeSparqlUpdate(update);
    return { sensorId: normalizedSensorId, spaceId: normalizedSpaceId };
  }

  private normalizeIri(value: string): string {
    if (!value?.trim()) {
      throw new BadRequestException('spaceId is required');
    }
    let iri: URL;
    try {
      iri = new URL(value.trim());
    } catch {
      throw new BadRequestException(
        'spaceId must be an absolute HTTP, HTTPS, or URN IRI',
      );
    }
    if (!['http:', 'https:', 'urn:'].includes(iri.protocol)) {
      throw new BadRequestException(
        'spaceId must be an absolute HTTP, HTTPS, or URN IRI',
      );
    }
    return iri.href;
  }

  /**
   * Get entities by IFC type (IFCSpace, IFCWall, etc.)
   */
  async getEntitiesByType(entityType: string): Promise<RDFEntityResult[]> {
    this.logger.log(`Fetching IFC entities of type: ${entityType}`);
      const ontologyType = this.normalizeIfcType(entityType);

    const sparqlQuery = `
      PREFIX express: <https://w3id.org/express#>  
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?name ?globalId
      WHERE {
       ?entity rdf:type ?entityType .
       FILTER (REPLACE(STR(?entityType), "^.*[/#]", "") = ${JSON.stringify(ontologyType)})
       OPTIONAL { ?entity ?namePredicate ?nameObj .
         FILTER (STRENDS(STR(?namePredicate), "name_IfcRoot"))
             ?nameObj express:hasString ?name . }
       OPTIONAL { ?entity ?globalIdPredicate ?globalIdObj .
         FILTER (STRENDS(STR(?globalIdPredicate), "globalId_IfcRoot"))
             ?globalIdObj express:hasString ?globalId . }
      }
      ORDER BY ?name
    `;

    this.logger.log(`Executing SPARQL query: ${sparqlQuery}`);

    const result = await this.executeSparqlQuery(sparqlQuery);
    return this.transformSparqlResultToIFCEntities(result, entityType);
  }

  /**
   * Get entities with filtering and pagination
   */
  async getEntities(query: RDFEntityListRequest): Promise<RDFEntityResponse> {
    this.logger.log(
      `Retrieving IFC entities with filters: ${JSON.stringify(query)}`,
    );

    const { entity_type, name_filter, limit = 500, skip = 0 } = query;

    let sparqlQuery = `
      PREFIX express: <https://w3id.org/express#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        FILTER (REGEX(STR(?entityType), "(^|[/#])Ifc[A-Za-z0-9_]*$"))
        OPTIONAL { ?entity ?namePredicate ?nameObj . FILTER (STRENDS(STR(?namePredicate), "name_IfcRoot")) ?nameObj express:hasString ?name . }
        OPTIONAL { ?entity ?globalIdPredicate ?globalIdObj . FILTER (STRENDS(STR(?globalIdPredicate), "globalId_IfcRoot")) ?globalIdObj express:hasString ?globalId . }
        OPTIONAL { ?entity ?descriptionPredicate ?descObj . FILTER (STRENDS(STR(?descriptionPredicate), "description_IfcRoot")) ?descObj express:hasString ?description . }
    `;

    // Add entity type filter
    if (entity_type) {
      const ontologyType = this.normalizeIfcType(entity_type);
      sparqlQuery += `FILTER (REPLACE(STR(?entityType), "^.*[/#]", "") = ${JSON.stringify(ontologyType)})`;
    }

    // Add name filter
    if (name_filter) {
      sparqlQuery += `FILTER (CONTAINS(LCASE(STR(?name)), LCASE("${name_filter}")))`;
    }

    sparqlQuery += `
      }
      ORDER BY ?name
      LIMIT ${limit}
      OFFSET ${skip}
    `;

    this.logger.log(`Executing SPARQL query: ${sparqlQuery}`);
    const result = await this.executeSparqlQuery(sparqlQuery);
    const entities = this.transformSparqlResultToIFCEntities(
      result,
      entity_type || 'Mixed',
    );

    // Get total count (simplified)
    const totalCount = entities.length; // In a production system, you'd run a separate COUNT query

    return {
      entity_id: 'sparql_query_result',
      filter_criteria: JSON.stringify(query),
      total_count: totalCount,
      entities: entities,
    };
  }

  /**
   * Get entity by Global ID
   */
  async getEntityByGlobalId(globalId: string): Promise<RDFEntityResult | null> {
    this.logger.log(`Retrieving RDF entity with Global ID: ${globalId}`);
    const key = this.entityCacheKey(globalId);
    const cached = await this.cache.get(key);
    if (cached !== null) {
      try {
        const entity: unknown = JSON.parse(cached);
        if (
          !entity ||
          typeof entity !== 'object' ||
          !('created_at' in entity) ||
          typeof entity.created_at !== 'string' ||
          Number.isNaN(Date.parse(entity.created_at)) ||
          !('entity_type' in entity) ||
          typeof entity.entity_type !== 'string' ||
          !('name' in entity) ||
          typeof entity.name !== 'string' ||
          !('properties' in entity) ||
          !entity.properties ||
          typeof entity.properties !== 'object'
        ) {
          throw new Error('Cached RDF entity has an invalid shape');
        }
        const cachedEntity = entity as RDFEntityResult & { created_at: string };
        const result = {
          ...cachedEntity,
          created_at: new Date(cachedEntity.created_at),
        };
        return result;
      } catch (error) {
        this.logger.warn(
          `Invalid cached RDF entity: ${(error as Error).message}`,
        );
        await this.cache.del(key);
      }
    }

    const sparqlQuery = `
      PREFIX express: <https://w3id.org/express#>  
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        ?entity ?globalIdPredicate ?globalIdObj .
        FILTER (STRENDS(STR(?globalIdPredicate), "globalId_IfcRoot"))
        ?globalIdObj express:hasString ${JSON.stringify(globalId)} .
        OPTIONAL { ?entity ?namePredicate ?nameObj . FILTER (STRENDS(STR(?namePredicate), "name_IfcRoot")) . ?nameObj express:hasString ?name . }
        OPTIONAL { ?entity ?descriptionPredicate ?descObj . FILTER (STRENDS(STR(?descriptionPredicate), "description_IfcRoot")) . ?descObj express:hasString ?description . }
      }
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    const entities = this.transformSparqlResultToIFCEntities(result, 'Unknown');
    const entity = entities.length > 0 ? entities[0] : null;
    if (entity) {
      await this.cache.set(
        key,
        JSON.stringify(entity),
        this.entityCacheTtlSeconds,
      );
    }
    return entity;
  }

  private entityCacheKey(globalId: string): string {
    const digest = createHash('sha256')
      .update(JSON.stringify([this.rdfServerUrl, globalId]))
      .digest('hex');
    return `pdh:rdf:entity:v1:${digest}`;
  }
  /**
   * Transform SPARQL results to IFC entity format
   */
  private transformSparqlResultToIFCEntities(
    result: SPARQLResult,
    defaultEntityType: string,
  ): RDFEntityResult[] {
    return result.results.bindings.map((binding) => {
      const entityUri = binding.entity?.value || binding.space?.value || '';
      const entityType = binding.entityType?.value
        ? binding.entityType.value.split(/[\/#]/).pop() || defaultEntityType
        : defaultEntityType;

      const properties: Record<string, any> = {
        uri: entityUri,
        description: binding.description?.value,
        longName: binding.longName?.value,
        compositionType: binding.compositionType?.value,
      };

      // Remove undefined properties
      Object.keys(properties).forEach((key) => {
        if (properties[key] === undefined) {
          delete properties[key];
        }
      });

      return {
        entity_type: entityType,
        name: binding.name?.value || 'Unnamed',
        properties: properties,
        global_id: binding.globalId?.value,
        created_at: new Date(), // RDF doesn't have creation timestamps by default
      };
    });
  }

  async getEntityById(entityId: string): Promise<RDFEntityResult | null> {
    // For RDF, we'll use global ID instead
    return this.getEntityByGlobalId(entityId);
  }

  private normalizeIfcType(entityType: string): string {
    const typeName = entityType.trim();
    const bareName = /^ifc/i.test(typeName) ? typeName.slice(3) : typeName;
    const normalizedName =
      bareName === bareName.toUpperCase()
        ? `${bareName.charAt(0)}${bareName.slice(1).toLowerCase()}`
        : `${bareName.charAt(0).toUpperCase()}${bareName.slice(1)}`;
    return `Ifc${normalizedName}`;
  }

  async updateEntity(
    entityId: string,
    updateEntityDto: Partial<RDFEntity>,
  ): Promise<RDFEntityResult | null> {
    throw new Error(
      'Update operations not supported for read-only RDF repository',
    );
  }

  private buildSpaceFilterExpressions(spaceId: string): string {
    const spaceIdValue = spaceId.trim();
    const localNameFilter = `REPLACE(STR(?space), "^.*[/#]", "") = ${JSON.stringify(spaceIdValue)}`;
    const exactFilter = `STR(?space) = ${JSON.stringify(spaceIdValue)}`;
    const instanceSpaceMatch = this.instanceNamespace
      ? `STR(?space) = ${JSON.stringify(new URL(spaceIdValue, this.instanceNamespace).toString())}`
      : '';

    const filters = [exactFilter, localNameFilter];
    if (instanceSpaceMatch) {
      filters.push(instanceSpaceMatch);
    }

    return filters.map((filter) => `(${filter})`).join(' || ');
  }

  async getSpaceFileMappings(
    spaceId: string,
  ): Promise<
    Array<{
      fileId: string;
      fileRole?: string;
      mappingMethod?: string;
      mappingStatus?: string;
    }>
  > {
    const trimmedSpaceId = spaceId?.trim();
    if (!trimmedSpaceId) {
      return [];
    }

    const sparqlQuery = `
      PREFIX props: <${this.propsNamespace}>
      PREFIX inst: <${this.instanceNamespace}>

      SELECT DISTINCT ?file ?fileId ?fileRole ?mappingMethod ?mappingStatus
      WHERE {
        GRAPH <${this.fileMappingGraphUri}> {
          ?space props:hasAssociatedFile ?file .
          ?file props:fileId ?fileId .

          OPTIONAL { ?file props:fileRole ?fileRole . }
          OPTIONAL { ?file props:mappingMethod ?mappingMethod . }
          OPTIONAL { ?file props:mappingStatus ?mappingStatus . }

          FILTER (
            ${this.buildSpaceFilterExpressions(trimmedSpaceId)}
          )
        }
      }
    `;

    try {
      const result = await this.executeSparqlQuery(sparqlQuery);
      return result.results.bindings.map((binding) => ({
        fileId: binding.fileId?.value || binding.file?.value || '',
        fileRole: binding.fileRole?.value,
        mappingMethod: binding.mappingMethod?.value,
        mappingStatus: binding.mappingStatus?.value,
      }));
    } catch (error) {
      this.logger.error(`Failed to get files for space ${spaceId}:`, error);
      return [];
    }
  }

  async getSpacesForFile(
    fileId: string,
  ): Promise<string[]> {
    const trimmedFileId = fileId?.trim();
    if (!trimmedFileId) {
      return [];
    }

    const sparqlQuery = `
      PREFIX props: <${this.propsNamespace}>
      PREFIX inst: <${this.instanceNamespace}>

      SELECT DISTINCT ?space
      WHERE {
        GRAPH <${this.fileMappingGraphUri}> {
          ?space props:hasAssociatedFile ?file .
          ?file props:fileId ${JSON.stringify(trimmedFileId)} .
        }
      }
    `;

    try {
      const result = await this.executeSparqlQuery(sparqlQuery);
      return result.results.bindings.map((binding) => {
        const value = binding.space?.value || '';
        return value;
      });
    } catch (error) {
      this.logger.error(`Failed to get spaces for file ${fileId}:`, error);
      return [];
    }
  }

  /**
   * Query sensor-space mapping from the mapping graph
   * Returns space information for a given sensor ID
   */
  async getSensorSpaceMapping(
    sensorId: string,
  ): Promise<{ spaceId: string; spaceName: string } | null> {
    this.logger.log(`Querying space mapping for sensor: ${sensorId}`);

    const sparqlQuery = `
      PREFIX : <http://ams.validation/ontology#>
      PREFIX asset: <http://example.org/asset#>
      PREFIX express: <https://w3id.org/express#>
      
      SELECT ?sensor ?spaceId ?resolvedSpaceName
      WHERE {
        GRAPH <${this.mappingGraphUri}> {
          VALUES ?sensorIdPredicate { asset:sensorId :sensorId }
          VALUES ?locatedInPredicate { asset:locatedIn :locatedIn }
          ?sensor ?sensorIdPredicate "${sensorId}" .
          ?sensor ?locatedInPredicate ?space .
        }
        BIND(STR(?space) AS ?spaceId)
        OPTIONAL {
          ?space ?namePredicate ?nameObj .
          FILTER (STRENDS(STR(?namePredicate), "name_IfcRoot"))
          ?nameObj express:hasString ?spaceName .
        }
        OPTIONAL {
          GRAPH <${this.mappingGraphUri}> {
            ?space asset:name ?mappedSpaceName .
          }
        }
        BIND(COALESCE(?spaceName, ?mappedSpaceName) AS ?resolvedSpaceName)
      }
      LIMIT 1
    `;

    try {
      const result = await this.executeSparqlQuery(sparqlQuery);
      if (result.results.bindings.length > 0) {
        const binding = result.results.bindings[0];
        return {
          spaceId: binding.spaceId?.value || '',
          spaceName:
            binding.resolvedSpaceName?.value || binding.spaceId?.value || '',
        };
      }
      return null;
    } catch (error) {
      this.logger.error(
        `Failed to get space mapping for sensor ${sensorId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Query all sensors in a space from the mapping graph
   */
  async getSpaceSensorsMappings(
    spaceId: string,
  ): Promise<Array<{ sensorId: string; sensorName: string }>> {
    this.logger.log(`Querying sensors in space: ${spaceId}`);

    const sparqlQuery = `
      PREFIX : <http://ams.validation/ontology#>
      PREFIX asset: <http://example.org/asset#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?sensor ?sensorId ?sensorName
      WHERE {
        GRAPH <${this.mappingGraphUri}> {
          VALUES ?sensorIdPredicate { asset:sensorId :sensorId }
          VALUES ?locatedInPredicate { asset:locatedIn :locatedIn }
          ?sensor ?locatedInPredicate <${spaceId}> .
          ?sensor ?sensorIdPredicate ?sensorId .
          OPTIONAL { ?sensor rdf:label ?rdfLabel . }
          OPTIONAL { ?sensor asset:name ?assetName . }
        }
        BIND(COALESCE(?rdfLabel, ?assetName, ?sensorId) AS ?sensorName)
      }
    `;

    try {
      const result = await this.executeSparqlQuery(sparqlQuery);
      return result.results.bindings.map((binding) => ({
        sensorId: binding.sensorId?.value || '',
        sensorName: binding.sensorName?.value || binding.sensorId?.value || '',
      }));
    } catch (error) {
      this.logger.error(`Failed to get sensors for space ${spaceId}:`, error);
      return [];
    }
  }
}
