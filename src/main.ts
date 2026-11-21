import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrlRaw = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const configuredOrigins = frontendUrlRaw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: Array.from(
      new Set([
        ...configuredOrigins,
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
      ]),
    ),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  await app.listen(port, '0.0.0.0');
  logger.log(`Jus Digital API rodando em http://localhost:${port}/api`);
}

void bootstrap();
