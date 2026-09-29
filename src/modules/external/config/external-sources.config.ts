import { ConfigService } from '@nestjs/config';
import { ExternalSourceConfig } from '../interfaces/http-source-adapter.interface';

/**
 * Builds the registry of preconfigured external HTTP sources from
 * environment variables. Adding a new source (FM API, ERP, GIS, ...) only
 * requires adding another entry here plus its env vars - no controller or
 * consuming application change is needed.
 */
export function buildExternalSourcesConfig(
  configService: ConfigService,
): Record<string, ExternalSourceConfig> {
  const sources: Record<string, ExternalSourceConfig> = {};

  const weatherBaseUrl = configService.get<string>('WEATHER_API_BASE_URL');
  if (weatherBaseUrl) {
    sources.weather = {
      name: 'weather',
      baseUrl: weatherBaseUrl,
      timeoutMs:
        Number(configService.get<string>('WEATHER_API_TIMEOUT_MS')) || 5000,
      auth: {
        type:
          (configService.get<string>('WEATHER_API_AUTH_TYPE') as
            | 'none'
            | 'apiKey'
            | 'bearer') || 'apiKey',
        headerName:
          configService.get<string>('WEATHER_API_KEY_HEADER') || 'x-api-key',
        secretEnvVar: 'WEATHER_API_KEY',
      },
      operations: {
        current: {
          method: 'GET',
          path: '/current',
          allowedParams: ['lat', 'lon'],
        },
      },
    };
  }

  return sources;
}
