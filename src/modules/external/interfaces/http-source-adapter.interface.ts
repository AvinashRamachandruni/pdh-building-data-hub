/**
 * Supported authentication strategies for a configured external HTTP source.
 * Secrets are always read from environment variables at request time and
 * are never included in Swagger docs or API responses.
 */
export type ExternalSourceAuthType = 'none' | 'apiKey' | 'bearer';

export interface ExternalSourceAuthConfig {
  type: ExternalSourceAuthType;
  /** HTTP header name used to carry the api key (authType = 'apiKey') */
  headerName?: string;
  /** Name of the environment variable holding the secret value */
  secretEnvVar?: string;
}

/** A single allowed operation (endpoint) exposed by a configured source. */
export interface ExternalSourceOperation {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path appended to the source's baseUrl, may contain :placeholders */
  path: string;
  /** Query/path parameter names this operation accepts */
  allowedParams?: string[];
}

/** Declarative configuration for one external HTTP source. */
export interface ExternalSourceConfig {
  name: string;
  baseUrl: string;
  auth: ExternalSourceAuthConfig;
  timeoutMs: number;
  operations: Record<string, ExternalSourceOperation>;
  healthCheck?: {
    path: string;
    params?: Record<string, string>;
  };
}

/**
 * Reusable contract for calling preconfigured external HTTP APIs. Only
 * sources and operations declared in configuration can be invoked - this is
 * intentionally not a generic HTTP proxy.
 */
export interface HttpSourceAdapter {
  invoke(
    sourceName: string,
    operationName: string,
    params?: Record<string, string>,
  ): Promise<unknown>;
  healthCheck(sourceName: string): Promise<ExternalSourceStatus>;
  listSourceNames(): string[];
}

export interface ExternalSourceStatus {
  source: string;
  status: 'ok' | 'unreachable' | 'unconfigured';
}
