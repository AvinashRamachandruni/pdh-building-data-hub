import { ApiProperty } from '@nestjs/swagger';

export class RDFEntity {
  @ApiProperty()
  entity_id: string;

  @ApiProperty({
    description: 'Type of IFC entity (e.g., IFCSpace, IFCWall, IFCDoor, etc.)',
  })
  entity_type: string;

  @ApiProperty({
    description: 'Name or label of the IFC entity',
  })
  name: string;

  @ApiProperty({
    description: 'Properties specific to the IFC entity type',
  })
  properties: Record<string, any>;

  @ApiProperty({
    description: 'Global Unique Identifier from IFC file',
    required: false,
  })
  global_id?: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({
    required: false,
  })
  updated_at?: Date;
}

export class RDFEntityResult {
  @ApiProperty()
  entity_type: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    description: 'Properties of the RDF entity',
  })
  properties: Record<string, any>;

  @ApiProperty()
  global_id?: string;

  @ApiProperty()
  created_at: Date;
}

export class RDFEntityResponse {
  @ApiProperty()
  entity_id: string;

  @ApiProperty({
    description: 'Filter criteria used for the query',
  })
  filter_criteria: string;

  @ApiProperty()
  total_count: number;

  @ApiProperty({
    type: [RDFEntityResult],
    description: 'List of IFC entities matching the criteria',
  })
  entities: RDFEntityResult[];
}

export class RDFEntityListRequest {
  @ApiProperty({
    required: false,
    description: 'Filter by entity type (e.g., IFCSpace, IFCWall)',
  })
  entity_type?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by entity name (partial match)',
  })
  name_filter?: string;

  @ApiProperty({
    required: false,
    description: 'Limit number of results',
    default: 100,
  })
  limit?: number;

  @ApiProperty({
    required: false,
    description: 'Skip number of results for pagination',
    default: 0,
  })
  skip?: number;
}
