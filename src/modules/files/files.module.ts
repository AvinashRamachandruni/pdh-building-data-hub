import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalFileSourceAdapter } from './adapters/local-file-source.adapter';
import { FILE_SOURCE_ADAPTER } from './interfaces/file-source-adapter.interface';

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [
    LocalFileSourceAdapter,
    {
      // Swapping to another backend (e.g. S3/MinIO) only requires changing
      // this binding; FilesService/FilesController remain untouched.
      provide: FILE_SOURCE_ADAPTER,
      useExisting: LocalFileSourceAdapter,
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
