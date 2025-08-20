import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: { level: 'error' } }),
  );

  // Enable CORS for all origins
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Personalised Building Data Hub API')
    .setDescription('API for PDH')
    .setVersion('1.0')
    .addBearerAuth()
    .addOAuth2()
    .addServer('/')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Use ConfigService for PORT
  const configService = app.get(ConfigService);
  const port = Number(configService.get('PORT')) || 3000;
  await app.listen(port);
}
bootstrap();
