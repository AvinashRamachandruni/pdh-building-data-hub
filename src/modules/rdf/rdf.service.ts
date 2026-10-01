import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
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

export interface SpaceSensorLink {
  rdfSensorId: string;
  measurementSensorId: string;
}

export interface SpaceFileMapping {
  fileId: string;
  fileRole?: string;
  mappingMethod?: string;
  mappingStatus?: string;
}

@Injectable()
export class RdfService {
  private readonly logger = new Logger(RdfService.name);
  private readonly rdfServerUrl: string;
  private readonly mappingGraphUri: string;
  private readonly fileMappingGraphUri: string;
  private readonly entityCacheTtlSeconds: number;
  private readonly propsNamespace?: string;

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
      'https://pdh.example/graph/file-mappings';
    this.propsNamespace =
      this.configService.get<string>('RDF_PROPS_NAMESPACE')?.trim() ||
      undefined;
    this.logger.log(`RDF Server URL: ${this.rdfServerUrl}`);
    this.logger.log(`RDF mapping graph: ${this.mappingGraphUri}`);
    this.logger.log(`File mapping graph: ${this.fileMappingGraphUri}`);
    if (this.propsNamespace) {
      this.logger.log(`RDF props namespace: ${this.propsNamespace}`);
    } else {
      this.logger.warn(
        'RDF_PROPS_NAMESPACE is not configured; mapping queries will match the required predicate local names',
      );
    }
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

  private propsPrefix(): string {
    return this.propsNamespace
      ? `PREFIX props: <${this.propsNamespace}>`
      : '';
  }

  private propsTriple(
    subject: string,
    predicate: string,
    object: string,
    variableName: string,
  ): string {
    if (this.propsNamespace) {
      return `${subject} props:${predicate} ${object} .`;
    }

    const predicateVariable = `?${variableName}`;
    return `${subject} ${predicateVariable} ${object} .
        FILTER (REGEX(STR(${predicateVariable}), "[/#]${predicate}$"))`;
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

  async resolveBotSpaceFromIfcSpace(
    ifcSpaceIdOrUri: string,
  ): Promise<string | null> {
    const identifier = ifcSpaceIdOrUri?.trim();
    if (!identifier) {
      throw new BadRequestException('ifcSpaceId is required');
    }

    let fullIfcUri: string | undefined;
    try {
      const parsed = new URL(identifier);
      if (!['http:', 'https:', 'urn:'].includes(parsed.protocol)) {
        throw new Error('Unsupported IFC space URI scheme');
      }
      fullIfcUri = parsed.href;
    } catch {
      if (/^[a-z][a-z\d+.-]*:/i.test(identifier)) {
        throw new BadRequestException(
          'ifcSpaceId must be a local identifier or an absolute HTTP, HTTPS, or URN URI',
        );
      }
    }

    const ifcSpaceFilter = fullIfcUri
      ? `STR(?ifcSpace) = ${JSON.stringify(fullIfcUri)}`
      : `REPLACE(STR(?ifcSpace), "^.*[/#]", "") = ${JSON.stringify(identifier)}`;
    const sparqlQuery = `
      PREFIX bot: <https://w3id.org/bot#>
      ${this.propsPrefix()}

      SELECT DISTINCT ?botSpace
      WHERE {
        ?botSpace a bot:Space .
        ${this.propsTriple(
          '?botSpace',
          'mappedIfcSpace',
          '?ifcSpace',
          'mappedIfcSpacePredicate',
        )}
        FILTER (${ifcSpaceFilter})
      }
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    const botSpaces = [
      ...new Set(
        result.results.bindings
          .map((binding) => binding.botSpace?.value)
          .filter((value): value is string => Boolean(value)),
      ),
    ];

    if (botSpaces.length === 0) {
      this.logger.warn(`No BOT space mapping found for IFC space ${identifier}`);
      return null;
    }
    if (botSpaces.length > 1) {
      this.logger.error(
        `Mapping inconsistency: IFC space ${identifier} maps to ${botSpaces.length} BOT spaces`,
      );
      throw new ConflictException(
        `IFC space '${identifier}' maps to multiple BOT spaces`,
      );
    }

    return botSpaces[0];
  }

  async getSpaceFileMappings(
    spaceId: string,
  ): Promise<SpaceFileMapping[]> {
    const botSpaceUri = await this.resolveBotSpaceFromIfcSpace(spaceId);
    if (!botSpaceUri) {
      return [];
    }

    return this.getSpaceFileMappingsByBotSpace(botSpaceUri);
  }

  async getSpaceFileMappingsByBotSpace(
    botSpaceUri: string,
  ): Promise<SpaceFileMapping[]> {
    const sparqlQuery = `
      ${this.propsPrefix()}

      SELECT DISTINCT ?file ?fileId ?fileRole ?mappingMethod ?mappingStatus
      WHERE {
        GRAPH <${this.fileMappingGraphUri}> {
          ${this.propsTriple(
            '?botSpace',
            'hasAssociatedFile',
            '?file',
            'hasAssociatedFilePredicate',
          )}
          ${this.propsTriple('?file', 'fileId', '?fileId', 'fileIdPredicate')}

          OPTIONAL {
            ${this.propsTriple('?file', 'fileRole', '?fileRole', 'fileRolePredicate')}
          }
          OPTIONAL {
            ${this.propsTriple('?file', 'mappingMethod', '?mappingMethod', 'mappingMethodPredicate')}
          }
          OPTIONAL {
            ${this.propsTriple('?file', 'mappingStatus', '?mappingStatus', 'mappingStatusPredicate')}
          }
          FILTER (STR(?botSpace) = ${JSON.stringify(botSpaceUri)})
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
      this.logger.error(`Failed to get files for BOT space ${botSpaceUri}:`, error);
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
      ${this.propsPrefix()}

      SELECT DISTINCT ?space
      WHERE {
        GRAPH <${this.fileMappingGraphUri}> {
          ${this.propsTriple(
            '?space',
            'hasAssociatedFile',
            '?file',
            'hasAssociatedFilePredicate',
          )}
          ${this.propsTriple(
            '?file',
            'fileId',
            JSON.stringify(trimmedFileId),
            'fileIdPredicate',
          )}
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
    const botSpaceUri = await this.resolveBotSpaceFromIfcSpace(spaceId);
    if (!botSpaceUri) {
      return [];
    }

    const sensors = await this.getSpaceSensorLinksByBotSpace(botSpaceUri);
    return sensors.map((sensor) => ({
      sensorId: sensor.measurementSensorId,
      sensorName: sensor.measurementSensorId,
    }));
  }

  async getSpaceSensorLinksByIfcSpace(
    ifcSpaceIdOrUri: string,
  ): Promise<SpaceSensorLink[]> {
    const botSpaceUri = await this.resolveBotSpaceFromIfcSpace(
      ifcSpaceIdOrUri,
    );
    if (!botSpaceUri) {
      return [];
    }
    return this.getSpaceSensorLinksByBotSpace(botSpaceUri);
  }

  async getSpaceSensorLinksByBotSpace(
    botSpaceUri: string,
  ): Promise<SpaceSensorLink[]> {
    const sparqlQuery = `
      PREFIX bot: <https://w3id.org/bot#>
      ${this.propsPrefix()}
      
      SELECT DISTINCT ?sensor ?measurementSensorId
      WHERE {
        ?botSpace a bot:Space ;
          bot:containsElement ?sensor .
        ${this.propsTriple(
          '?sensor',
          'measurementSensorId',
          '?measurementSensorId',
          'measurementSensorIdPredicate',
        )}
        FILTER (STR(?botSpace) = ${JSON.stringify(botSpaceUri)})
      }
    `;

    try {
      const result = await this.executeSparqlQuery(sparqlQuery);
      return result.results.bindings.map((binding) => ({
        rdfSensorId: binding.sensor?.value || '',
        measurementSensorId: binding.measurementSensorId?.value || '',
      }));
    } catch (error) {
      this.logger.error(
        `Failed to get sensors for BOT space ${botSpaceUri}:`,
        error,
      );
      return [];
    }
  }
}
