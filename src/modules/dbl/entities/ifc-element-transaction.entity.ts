import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'ifc_element_transactions' })
export class IfcElementTransaction {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'char', length: 22 })
  parent_guid: string;

  @Column({ type: 'varchar', length: 64 })
  event_type: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  child_type?: string;

  @Column({ type: 'char', length: 22, nullable: true })
  old_child_guid?: string;

  @Column({ type: 'char', length: 22, nullable: true })
  new_child_guid?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  property_name?: string;

  @Column({ type: 'text', nullable: true })
  old_value?: string;

  @Column({ type: 'text', nullable: true })
  new_value?: string;

  // @Column({ type: 'uuid', nullable: true })
  // batch_id?: string;

  // @Column({ type: 'jsonb', nullable: true })
  // details?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  change_reason?: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  changed_by?: string;

  @CreateDateColumn({ type: 'timestamp' })
  change_timestamp: Date;
}
