import { INestApplication, VERSION_NEUTRAL, VersioningType } from '@nestjs/common';

export const API_VERSION = '2.2';

export function configureApiVersioning(app: INestApplication): void {
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: [API_VERSION, VERSION_NEUTRAL],
  });
}