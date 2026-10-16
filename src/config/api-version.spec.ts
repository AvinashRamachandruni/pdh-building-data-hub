import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppController } from '../app.controller';
import { API_VERSION, configureApiVersioning } from './api-version';

@Controller('example')
class ExampleController {
  @Get()
  getExample() {
    return { status: 'ok' };
  }
}

describe('API versioning', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [ExampleController, AppController],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApiVersioning(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/v2.2/example', '/example', '/health', '/v2.2/health'])(
    'serves %s',
    async (url) => {
      const response = await app.inject({ method: 'GET', url });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok' });
    },
  );

  it('does not serve an unsupported version', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v2.1/example',
    });

    expect(response.statusCode).toBe(404);
  });

  it('documents the current version and versioned routes', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setVersion(API_VERSION).build(),
    );

    expect(document.info.version).toBe('2.2');
    expect(document.paths['/v2.2/example'].get).toBeDefined();
    expect(document.paths['/example'].get).toBeDefined();
  });
});