import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RdfController } from './rdf.controller';
import { RdfService } from './rdf.service';
import { IFCEntity, IFCEntitySchema } from './entities/rdfentity.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IFCEntity.name, schema: IFCEntitySchema }
    ]),
    ConfigModule
  ],
  controllers: [RdfController],
  providers: [RdfService],
  exports: [RdfService]
})
export class RdfModule {}