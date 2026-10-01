import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { buildExternalSourcesConfig } from '../config/external-sources.config';
import {
  ExternalSourceConfig,
  ExternalSourceStatus,
  HttpSourceAdapter,
} from '../interfaces/http-source-adapter.interface';

/**
 * Generic, reusable adapter for calling preconfigured external HTTP APIs.
 * Consumers of this service can only invoke sources/operations declared in
 * configuration - there is no way to reach an arbitrary URL through it.
 *
 * Auth secrets are resolved from environment variables at request time and
 * are never logged, thrown in error messages, or returned to callers.
 */
@Injectable()
export class HttpSourceAdapterService implements HttpSourceAdapter {
  private readonly logger = new Logger(HttpSourceAdapterService.name);
  private readonly sources: Record<string, ExternalSourceConfig>;

  constructor(private readonly configService: ConfigService) {
    this.sources = buildExternalSourcesConfig(this.configService);
  }

  listSourceNames(): string[] {
    return Object.keys(this.sources);
  }

  async invoke(
    sourceName: string,
    operationName: string,
    params: Record<string, string> = {},
  ): Promise<unknown> {
    const source = this.getSourceOrThrow(sourceName);
    const operation = source.operations[operationName];
    if (!operation) {
      throw new NotFoundException(
        `Operation '${operationName}' is not configured for source '${sourceName}'`,
      );
    }

    const headers = this.buildAuthHeaders(source);
    const query = this.pickAllowedParams(params, operation.allowedParams);

    try {
      const response = await axios.request({
        method: operation.method,
        url: `${source.baseUrl.replace(/\/$/, '')}${operation.path}`,
        params: query,
        headers,
        timeout: source.timeoutMs,
      });
      return response.data;
    } catch (error: any) {
      this.handleRequestError(sourceName, error);
    }
  }

  async healthCheck(sourceName: string): Promise<ExternalSourceStatus> {
    const source = this.sources[sourceName];
    if (!source) {
      return { source: sourceName, status: 'unconfigured' };
    }

    try {
      await axios.get(
        `${source.baseUrl.replace(/\/$/, '')}${source.healthCheck?.path || ''}`,
        {
          params: source.healthCheck?.params,
          timeout: Math.min(source.timeoutMs, 3000),
        },
      );
      return { source: sourceName, status: 'ok' };
    } catch {
      return { source: sourceName, status: 'unreachable' };
    }
  }

  private getSourceOrThrow(sourceName: string): ExternalSourceConfig {
    const source = this.sources[sourceName];
    if (!source) {
      throw new NotFoundException(
        `Unknown or unconfigured external source '${sourceName}'`,
      );
    }
    return source;
  }

  private buildAuthHeaders(
    source: ExternalSourceConfig,
  ): Record<string, string> {
    if (source.auth.type === 'none') {
      return {};
    }

    const secret = source.auth.secretEnvVar
      ? this.configService.get<string>(source.auth.secretEnvVar)
      : undefined;

    if (!secret) {
      this.logger.error(
        `Missing credentials for external source '${source.name}' (env var '${source.auth.secretEnvVar}')`,
      );
      // Deliberately generic: never reveal which env var or that credentials
      // are the specific problem to API callers.
      throw new InternalServerErrorException(
        `External source '${source.name}' is not properly configured`,
      );
    }

    if (source.auth.type === 'apiKey') {
      return { [source.auth.headerName || 'x-api-key']: secret };
    }

    if (source.auth.type === 'bearer') {
      return { Authorization: `Bearer ${secret}` };
    }

    return {};
  }

  private pickAllowedParams(
    params: Record<string, string>,
    allowedParams: string[] = [],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of allowedParams) {
      if (params[key] !== undefined) {
        result[key] = params[key];
      }
    }
    return result;
  }

  private handleRequestError(sourceName: string, error: any): never {
    if (error.code === 'ECONNABORTED') {
      throw new RequestTimeoutException(
        `External source '${sourceName}' did not respond in time`,
      );
    }

    if (!error.response) {
      throw new ServiceUnavailableException(
        `External source '${sourceName}' is unavailable`,
      );
    }

    this.logger.error(
      `External source '${sourceName}' returned status ${error.response.status}`,
    );
    throw new ServiceUnavailableException(
      `External source '${sourceName}' returned an error response`,
    );
  }
}
