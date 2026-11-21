import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Jus Digital — API de Gestão e Análise de Documentos com IA')
    .setDescription(
      [
        'API RESTful desenvolvida para o Desafio Técnico FullStack da Jus Digital.',
        '',
        '**Fluxo principal:**',
        '1. Autentique-se via **Google OAuth 2.0** em `POST /api/auth/google` para receber o token JWT.',
        '2. Clique em **Authorize** acima e informe o JWT (`Bearer`) para testar os endpoints protegidos.',
        '3. Envie documentos (`multipart/form-data`) em `POST /api/documents` — o arquivo original é salvo na **AWS S3**, analisado pelo **OpenAI GPT-4o-mini** e os metadados/análise são persistidos no **PostgreSQL**.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Informe o token JWT retornado pelo endpoint /api/auth/google',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Monitoramento de disponibilidade da API')
    .addTag('Auth', 'Autenticação Google OAuth 2.0 e perfil do usuário')
    .addTag('Documents', 'Upload na AWS S3, análise com OpenAI GPT-4o-mini, listagem e exclusão')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Jus Digital API — Swagger Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`Jus Digital API rodando em http://localhost:${port}/api`);
  logger.log(`Documentação Swagger disponível em http://localhost:${port}/api/docs`);
}

void bootstrap();
