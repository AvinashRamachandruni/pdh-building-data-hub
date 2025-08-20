import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
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

  constructor(private configService: ConfigService) {
    const rdfServerUrl = this.configService.get<string>('RDF_SERVER');
    if (!rdfServerUrl) {
      throw new Error('RDF_SERVER environment variable is not configured');
    }
    this.rdfServerUrl = rdfServerUrl;
    this.logger.log(`RDF Server URL: ${this.rdfServerUrl}`);
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

  /**
   * Get entities by IFC type (IFCSpace, IFCWall, etc.)
   */
  async getEntitiesByType(entityType: string): Promise<RDFEntityResult[]> {
    this.logger.log(`Fetching IFC entities of type: ${entityType}`);

    // Map common IFC types to their ontology names
    const ifcTypeMap: Record<string, string> = {
      IFCSpace: 'IfcSpace',
      IFCWall: 'IfcWall',
      IFCDoor: 'IfcDoor',
      IFCWindow: 'IfcWindow',
      IFCBeam: 'IfcBeam',
      IFCColumn: 'IfcColumn',
      IFCSlab: 'IfcSlab',
      IFCBuildingStorey: 'IfcBuildingStorey',
      IFCBuilding: 'IfcBuilding',
    };

    const ontologyType = ifcTypeMap[entityType] || entityType;

    // Simple query: only required fields, no OPTIONALs
    const sparqlQuery = `
      PREFIX express: <https://w3id.org/express#>  
      PREFIX ifc: <https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?entity ?name ?globalId
      WHERE {
        ?entity rdf:type ifc:${ontologyType} .
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj .
             ?nameObj express:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj .
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
      PREFIX ifc: <https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        FILTER CONTAINS(STR(?entityType), "IFC2x3")
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj express:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj express:hasString ?globalId . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj express:hasString ?description . }
    `;

    // Add entity type filter
    if (entity_type) {
      const ifcTypeMap: Record<string, string> = {
        IFCSpace: 'IfcSpace',
        IFCWall: 'IfcWall',
        IFCDoor: 'IfcDoor',
        IFCWindow: 'IfcWindow',
      };
      const ontologyType = ifcTypeMap[entity_type] || entity_type;
      sparqlQuery += `FILTER (?entityType = ifc:${ontologyType})`;
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

    const sparqlQuery = `
      PREFIX express: <https://w3id.org/express#>  
      PREFIX ifc: <https://standards.buildingsmart.org/IFC/DEV/IFC2x3/TC1/OWL#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        ?entity ifc:globalId_IfcRoot ?globalIdObj .
        ?globalIdObj express:hasString "${globalId}" .
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj expresss:hasString ?name . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj express:hasString ?description . }
      }
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    const entities = this.transformSparqlResultToIFCEntities(result, 'Unknown');
    return entities.length > 0 ? entities[0] : null;
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
        ? binding.entityType.value.split('#').pop() || defaultEntityType
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

  async updateEntity(
    entityId: string,
    updateEntityDto: Partial<RDFEntity>,
  ): Promise<RDFEntityResult | null> {
    throw new Error(
      'Update operations not supported for read-only RDF repository',
    );
  }
}
