import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StorageModule } from './modules/storage/storage.module';
import { AiModule } from './modules/ai/ai.module';
import { DocumentsModule } from './modules/documents/documents.module';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Verificar saúde da API',
    description: 'Endpoint público de monitoramento para validar se a API está operacional.',
  })
  @ApiOkResponse({
    description: 'Serviço operando normalmente.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'jus-digital-backend' },
        timestamp: { type: 'string', example: '2026-11-21T01:30:00.000Z' },
      },
    },
  })
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'jus-digital-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    StorageModule,
    AiModule,
    DocumentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
