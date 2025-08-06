import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import {
  IFCEntity,
  IFCEntityResponse,
  IFCEntityResult,
  IFCEntityListRequest,
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
      const response: AxiosResponse<SPARQLResult> = await axios.post(
        this.rdfServerUrl,
        `query=${encodeURIComponent(query)}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/sparql-results+json',
          },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`SPARQL query failed: ${error.message}`);
      throw new Error(`Failed to execute SPARQL query: ${error.message}`);
    }
  }

  /**
   * Get all IFC Spaces from RDF repository
   */
  async getAllIFCSpaces(): Promise<IFCEntityResult[]> {
    this.logger.log('Fetching all IFC Spaces from RDF repository');

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?space ?name ?globalId ?description ?longName ?compositionType
      WHERE {
        ?space rdf:type ifc:IfcSpace .
        OPTIONAL { ?space ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?space ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj ifc:hasString ?globalId . }
        OPTIONAL { ?space ifc:description_IfcRoot ?descObj . ?descObj ifc:hasString ?description . }
        OPTIONAL { ?space ifc:longName_IfcSpatialStructureElement ?longNameObj . ?longNameObj ifc:hasString ?longName . }
        OPTIONAL { ?space ifc:compositionType_IfcSpatialStructureElement ?compTypeObj . ?compTypeObj ifc:hasString ?compositionType . }
      }
      ORDER BY ?name
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    return this.transformSparqlResultToIFCEntities(result, 'IFCSpace');
  }

  /**
   * Get entities by IFC type (IFCSpace, IFCWall, etc.)
   */
  async getEntitiesByType(entityType: string): Promise<IFCEntityResult[]> {
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

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?entity ?name ?globalId ?description ?longName
      WHERE {
        ?entity rdf:type ifc:${ontologyType} .
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj ifc:hasString ?globalId . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj ifc:hasString ?description . }
        OPTIONAL { ?entity ifc:longName_IfcSpatialStructureElement ?longNameObj . ?longNameObj ifc:hasString ?longName . }
      }
      ORDER BY ?name
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    return this.transformSparqlResultToIFCEntities(result, entityType);
  }

  /**
   * Get entities with filtering and pagination
   */
  async getEntities(query: IFCEntityListRequest): Promise<IFCEntityResponse> {
    this.logger.log(
      `Retrieving IFC entities with filters: ${JSON.stringify(query)}`,
    );

    const { entity_type, name_filter, limit = 100, skip = 0 } = query;

    let sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        FILTER (STRSTARTS(STR(?entityType), "http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#Ifc"))
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj ifc:hasString ?globalId . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj ifc:hasString ?description . }
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
  async getEntityByGlobalId(globalId: string): Promise<IFCEntityResult | null> {
    this.logger.log(`Retrieving IFC entity with Global ID: ${globalId}`);

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        ?entity ifc:globalId_IfcRoot ?globalIdObj .
        ?globalIdObj ifc:hasString "${globalId}" .
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj ifc:hasString ?description . }
      }
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    const entities = this.transformSparqlResultToIFCEntities(result, 'Unknown');
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Search entities by name or description
   */
  async searchEntities(searchTerm: string): Promise<IFCEntityResult[]> {
    this.logger.log(`Searching IFC entities with term: ${searchTerm}`);

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?description
      WHERE {
        ?entity rdf:type ?entityType .
        FILTER (STRSTARTS(STR(?entityType), "http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#Ifc"))
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj ifc:hasString ?globalId . }
        OPTIONAL { ?entity ifc:description_IfcRoot ?descObj . ?descObj ifc:hasString ?description . }
        
        FILTER (
          CONTAINS(LCASE(STR(?name)), LCASE("${searchTerm}")) ||
          CONTAINS(LCASE(STR(?description)), LCASE("${searchTerm}")) ||
          CONTAINS(LCASE(STR(?globalId)), LCASE("${searchTerm}"))
        )
      }
      ORDER BY ?name
      LIMIT 50
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    return this.transformSparqlResultToIFCEntities(result, 'Mixed');
  }

  /**
   * Get count of entities by type
   */
  async getEntityCountByType(): Promise<Record<string, number>> {
    this.logger.log('Getting entity count by type');

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entityType (COUNT(?entity) AS ?count)
      WHERE {
        ?entity rdf:type ?entityType .
        FILTER (STRSTARTS(STR(?entityType), "http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#Ifc"))
      }
      GROUP BY ?entityType
      ORDER BY DESC(?count)
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    const countByType: Record<string, number> = {};

    result.results.bindings.forEach((binding) => {
      const typeUri = binding.entityType?.value || '';
      const typeName = typeUri.split('#').pop() || typeUri;
      const count = parseInt(binding.count?.value || '0', 10);
      countByType[typeName] = count;
    });

    return countByType;
  }

  /**
   * Transform SPARQL results to IFC entity format
   */
  private transformSparqlResultToIFCEntities(
    result: SPARQLResult,
    defaultEntityType: string,
  ): IFCEntityResult[] {
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

  // Legacy methods for compatibility (these would need to be implemented differently for RDF)
  async createEntity(
    createEntityDto: Partial<IFCEntity>,
  ): Promise<IFCEntityResult> {
    throw new Error(
      'Create operations not supported for read-only RDF repository',
    );
  }

  async getEntityById(entityId: string): Promise<IFCEntityResult | null> {
    // For RDF, we'll use global ID instead
    return this.getEntityByGlobalId(entityId);
  }

  async updateEntity(
    entityId: string,
    updateEntityDto: Partial<IFCEntity>,
  ): Promise<IFCEntityResult | null> {
    throw new Error(
      'Update operations not supported for read-only RDF repository',
    );
  }

  async deleteEntity(entityId: string): Promise<boolean> {
    throw new Error(
      'Delete operations not supported for read-only RDF repository',
    );
  }

  async createBulkEntities(
    entities: Partial<IFCEntity>[],
  ): Promise<IFCEntityResult[]> {
    throw new Error(
      'Bulk create operations not supported for read-only RDF repository',
    );
  }

  async getEntitiesWithProperty(
    propertyKey: string,
    propertyValue?: any,
  ): Promise<IFCEntityResult[]> {
    this.logger.log(`Getting entities with property: ${propertyKey}`);

    const sparqlQuery = `
      PREFIX ifc: <http://www.buildingsmart-tech.org/ifcOWL/IFC4_ADD2#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      
      SELECT ?entity ?entityType ?name ?globalId ?propertyValue
      WHERE {
        ?entity rdf:type ?entityType .
        ?entity ifc:${propertyKey} ?propertyValue .
        OPTIONAL { ?entity ifc:name_IfcRoot ?nameObj . ?nameObj ifc:hasString ?name . }
        OPTIONAL { ?entity ifc:globalId_IfcRoot ?globalIdObj . ?globalIdObj ifc:hasString ?globalId . }
        ${propertyValue ? `FILTER (?propertyValue = "${propertyValue}")` : ''}
      }
      ORDER BY ?name
    `;

    const result = await this.executeSparqlQuery(sparqlQuery);
    return this.transformSparqlResultToIFCEntities(result, 'Mixed');
  }
}
