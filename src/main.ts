import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConsoleLogger, LogLevel } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';

class TimestampFreeLogger extends ConsoleLogger {
  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    const output = this.stringifyMessage(message, logLevel);
    return `${this.colorize(pidMessage, logLevel)}${this.colorize(
      formattedLogLevel,
      logLevel,
    )} ${contextMessage}${output}${timestampDiff}\n`;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    {
      logger: new TimestampFreeLogger({
        timestamp: false,
      }),
    },
  );

  // Enable CORS for all origins
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('Unified Asset Interfaces')
    .setDescription('API for UAMS')
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
  await app.listen(port, '0.0.0.0');
}
bootstrap();
