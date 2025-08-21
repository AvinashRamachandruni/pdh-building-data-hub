// pdh.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Schema, Model } from 'mongoose';

@Injectable()
export class ToolsService {
  private models = new Map<string, Model<any>>();

  constructor(
    @InjectConnection('WILSONTOOLS') private readonly connection: Connection,
  ) {}

  private getModel(name: string): Model<any> {
    if (this.models.has(name)) return this.models.get(name)!;

    const schema = new Schema(
      {
        _id: { type: Number, required: true }, // timestamp as key
        data: { type: Object, required: true },
      },
      { versionKey: false },
    );

    const model = this.connection.model(name, schema, name);
    this.models.set(name, model);
    return model;
  }

  async createCollection(name: string): Promise<string> {
    this.getModel(name); // initialize model
    if (
      !this.connection.db ||
      !(await this.connection.db.listCollections({ name }).hasNext())
    ) {
      await this.connection.createCollection(name);
    }
    return `Collection '${name}' is ready`;
  }

  async insertDocument(name: string, data: any) {
    const model = this.getModel(name);
    const timestamp = Date.now();
    return model.create({ _id: timestamp, data });
  }

  async fetchAll(name: string) {
    return this.getModel(name).find().sort({ _id: 1 }).lean();
  }

  async fetchLatest(name: string) {
    const doc = await this.getModel(name).findOne().sort({ _id: -1 }).lean();
    if (!doc) throw new NotFoundException('No documents found');
    return doc;
  }
}
