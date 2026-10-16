import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  IS_LOCAL_RDF_EVALUATION_KEY,
  IS_PUBLIC_KEY,
} from './public.decorator';
import { KeycloakAuthGuard } from './keycloak-auth.guard';

function makeContext(remoteAddress: string): ExecutionContext {
  const request = {
    headers: {},
    raw: { socket: { remoteAddress } },
  };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeReflector(): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) =>
      key === IS_LOCAL_RDF_EVALUATION_KEY
        ? true
        : key === IS_PUBLIC_KEY
          ? false
          : undefined,
    ),
  } as unknown as Reflector;
}

describe('KeycloakAuthGuard local RDF evaluation', () => {
  it('allows loopback access to tagged RDF routes when explicitly enabled', async () => {
    const guard = new KeycloakAuthGuard(
      makeReflector(),
      {
        get: (name: string) =>
          name === 'PDH_ALLOW_LOCAL_RDF_EVALUATION' ? 'true' : undefined,
      } as ConfigService,
    );

    await expect(guard.canActivate(makeContext('127.0.0.1'))).resolves.toBe(
      true,
    );
    await expect(guard.canActivate(makeContext('::1'))).resolves.toBe(true);
  });

  it('rejects non-loopback requests even when local evaluation is enabled', async () => {
    const guard = new KeycloakAuthGuard(
      makeReflector(),
      {
        get: (name: string) =>
          name === 'PDH_ALLOW_LOCAL_RDF_EVALUATION' ? 'true' : undefined,
      } as ConfigService,
    );

    await expect(
      guard.canActivate(makeContext('192.168.1.10')),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects loopback requests when local evaluation is disabled', async () => {
    const guard = new KeycloakAuthGuard(
      makeReflector(),
      {
        get: (name: string) =>
          ({
            KEYCLOAK_ISSUER: 'https://identity.example/realm',
            KEYCLOAK_AUDIENCE: 'pdh',
            PDH_ALLOW_LOCAL_RDF_EVALUATION: 'false',
          })[name],
      } as ConfigService,
    );

    await expect(
      guard.canActivate(makeContext('127.0.0.1')),
    ).rejects.toThrow(UnauthorizedException);
  });
});
