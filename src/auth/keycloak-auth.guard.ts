import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { FastifyRequest } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthenticatedUser } from './authenticated-user';
import { IS_PUBLIC_KEY } from './public.decorator';

export interface AuthenticatedRequest extends FastifyRequest {
  user: AuthenticatedUser;
}

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    this.issuer = (
      config.get<string>('KEYCLOAK_ISSUER') ?? ''
    ).replace(/\/$/, '');

    this.audience =
      config.get<string>('KEYCLOAK_AUDIENCE') ?? '';

    if (!this.issuer || !this.audience) {
      throw new Error(
        'KEYCLOAK_ISSUER and KEYCLOAK_AUDIENCE must be configured',
      );
    }

    this.jwks = createRemoteJWKSet(
      new URL(
        `${this.issuer}/protocol/openid-connect/certs`,
      ),
    );
  }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (isPublic) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'A bearer access token is required',
      );
    }

    const token = authorization
      .slice('Bearer '.length)
      .trim();

    if (!token) {
      throw new UnauthorizedException(
        'A bearer access token is required',
      );
    }

    try {
      const { payload } = await jwtVerify(
        token,
        this.jwks,
        {
          issuer: this.issuer,
          audience: this.audience,
          algorithms: ['RS256'],
        },
      );

      request.user = payload as AuthenticatedUser;
      return true;
    } catch (error) {
      if (
        error instanceof TypeError &&
        error.message.includes('fetch')
      ) {
        throw new ServiceUnavailableException(
          'Keycloak is temporarily unavailable',
        );
      }

      throw new UnauthorizedException(
        'The access token is invalid or expired',
      );
    }
  }
}