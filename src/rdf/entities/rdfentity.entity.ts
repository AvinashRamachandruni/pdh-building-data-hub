import { ApiProperty } from '@nestjs/swagger';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IFCEntityDocument = HydratedDocument<IFCEntity>;

@Schema({
  collection: 'ifc_entities',
  toJSON: {
    transform: (
      doc: IFCEntityDocument,
      ret: Partial<IFCEntityDocument>,
      options: any,
    ) => {
      delete ret._id;
      delete ret.entity_id;
    },
  },
})
export class IFCEntity {
  @Prop({ required: true })
  @ApiProperty()
  entity_id: string;

  @Prop({ required: true })
  @ApiProperty({
    description: 'Type of IFC entity (e.g., IFCSpace, IFCWall, IFCDoor, etc.)',
  })
  entity_type: string;

  @Prop({ required: true })
  @ApiProperty({
    description: 'Name or label of the IFC entity',
  })
  name: string;

  @Prop({ type: Object })
  @ApiProperty({
    description: 'Properties specific to the IFC entity type',
  })
  properties: Record<string, any>;

  @Prop()
  @ApiProperty({
    description: 'Global Unique Identifier from IFC file',
    required: false,
  })
  global_id?: string;

  @Prop({ required: true })
  @ApiProperty()
  created_at: Date;

  @Prop()
  @ApiProperty({
    required: false,
  })
  updated_at?: Date;
}

export class IFCEntityResult {
  @ApiProperty()
  entity_type: string;

  @ApiProperty()
  name: string;

  @ApiProperty({
    description: 'Properties of the IFC entity',
  })
  properties: Record<string, any>;

  @ApiProperty()
  global_id?: string;

  @ApiProperty()
  created_at: Date;
}

export class IFCEntityResponse {
  @ApiProperty()
  entity_id: string;

  @ApiProperty({
    description: 'Filter criteria used for the query',
  })
  filter_criteria: string;

  @ApiProperty()
  total_count: number;

  @ApiProperty({
    type: [IFCEntityResult],
    description: 'List of IFC entities matching the criteria',
  })
  entities: IFCEntityResult[];
}

export class IFCEntityListRequest {
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

export const IFCEntitySchema = SchemaFactory.createForClass(IFCEntity);
