import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AiModule } from '../ai/ai.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DOCUMENT_REPOSITORY } from './interfaces/document.repository.interface';
import { PrismaDocumentRepository } from './repositories/prisma-document.repository';

@Module({
  imports: [StorageModule, AiModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    PrismaDocumentRepository,
    {
      provide: DOCUMENT_REPOSITORY,
      useExisting: PrismaDocumentRepository,
    },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
