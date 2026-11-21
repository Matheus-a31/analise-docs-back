import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { extname } from 'path';
import {
  DOCUMENT_REPOSITORY,
  DocumentEntity,
  IDocumentRepository,
} from './interfaces/document.repository.interface';
import {
  IStorageService,
  STORAGE_SERVICE,
} from '../storage/interfaces/storage.service.interface';
import {
  AI_ANALYZER_SERVICE,
  IAiAnalyzerService,
} from '../ai/interfaces/ai-analyzer.service.interface';
import { CreateDocumentDto } from './dto/create-document.dto';

export interface DocumentResponseDto extends DocumentEntity {
  downloadUrl: string;
}

export interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  private static readonly ALLOWED_EXTENSIONS = [
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.csv',
    '.md',
    '.json',
    '.png',
    '.jpg',
    '.jpeg',
    '.webp',
  ];

  constructor(
    @Inject(DOCUMENT_REPOSITORY)
    private readonly documentRepository: IDocumentRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    @Inject(AI_ANALYZER_SERVICE)
    private readonly aiAnalyzerService: IAiAnalyzerService,
  ) {}

  async createAndAnalyze(
    userId: string,
    file: UploadedFilePayload | undefined,
    dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    this.validateUploadedFile(file);

    const extension = this.extractExtension(file.originalname);

    const uploadResult = await this.storageService.uploadFile({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      userId,
    });

    let aiAnalysis: string | null = null;
    let analysisStatus: 'COMPLETED' | 'FAILED' = 'COMPLETED';
    let errorMessage: string | null = null;

    try {
      aiAnalysis = await this.aiAnalyzerService.analyzeDocument({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
        title: dto.title.trim(),
        instruction: dto.instruction.trim(),
      });
    } catch (error) {
      this.logger.warn(`Análise da IA falhou para o documento "${dto.title}":`, error);
      analysisStatus = 'FAILED';
      errorMessage =
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a análise com a IA no momento.';
    }

    const created = await this.documentRepository.create({
      title: dto.title.trim(),
      originalName: file.originalname,
      mimeType: file.mimetype,
      extension,
      sizeBytes: file.size,
      s3Key: uploadResult.key,
      s3Url: uploadResult.url,
      instruction: dto.instruction.trim(),
      aiAnalysis,
      analysisStatus,
      errorMessage,
      userId,
    });

    const downloadUrl = await this.storageService.getSignedDownloadUrl(created.s3Key);
    return {
      ...created,
      downloadUrl: downloadUrl || created.s3Url,
    };
  }

  async findAllByUser(userId: string): Promise<DocumentResponseDto[]> {
    const documents = await this.documentRepository.findAllByUserId(userId);
    return Promise.all(
      documents.map(async (doc) => {
        const downloadUrl = await this.storageService.getSignedDownloadUrl(doc.s3Key);
        return {
          ...doc,
          downloadUrl: downloadUrl || doc.s3Url,
        };
      }),
    );
  }

  async findOneByUser(id: string, userId: string): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findByIdAndUserId(id, userId);
    if (!document) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(document.s3Key);
    return {
      ...document,
      downloadUrl: downloadUrl || document.s3Url,
    };
  }

  async getFileContentByUser(
    id: string,
    userId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string }> {
    const document = await this.documentRepository.findByIdAndUserId(id, userId);
    if (!document) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const buffer = await this.storageService.getFileBuffer(document.s3Key);
    return {
      buffer,
      mimeType: document.mimeType || 'application/octet-stream',
      originalName: document.originalName,
    };
  }

  async retryAnalysis(id: string, userId: string): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findByIdAndUserId(id, userId);
    if (!document) {
      throw new NotFoundException('Documento não encontrado.');
    }

    const fileBuffer = await this.storageService.getFileBuffer(document.s3Key);

    try {
      const aiAnalysis = await this.aiAnalyzerService.analyzeDocument({
        buffer: fileBuffer,
        mimeType: document.mimeType,
        originalName: document.originalName,
        title: document.title,
        instruction: document.instruction,
      });

      const updated = await this.documentRepository.updateAnalysis(document.id, {
        aiAnalysis,
        analysisStatus: 'COMPLETED',
        errorMessage: null,
      });

      const downloadUrl = await this.storageService.getSignedDownloadUrl(updated.s3Key);
      return {
        ...updated,
        downloadUrl: downloadUrl || updated.s3Url,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Falha ao tentar analisar o documento novamente.';
      await this.documentRepository.updateAnalysis(document.id, {
        aiAnalysis: null,
        analysisStatus: 'FAILED',
        errorMessage: message,
      });
      throw error;
    }
  }

  async removeMany(
    ids: string[],
    userId: string,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    const documents = await this.documentRepository.findManyByIdsAndUserId(ids, userId);
    if (documents.length === 0) {
      throw new NotFoundException('Nenhum documento encontrado para exclusão.');
    }

    const s3Keys = documents.map((doc) => doc.s3Key);
    const foundIds = documents.map((doc) => doc.id);

    await this.storageService.deleteFiles(s3Keys);
    const deletedCount = await this.documentRepository.deleteManyByIdsAndUserId(foundIds, userId);

    return {
      deletedCount,
      deletedIds: foundIds,
    };
  }

  private validateUploadedFile(
    file: UploadedFilePayload | undefined,
  ): asserts file is UploadedFilePayload {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('É obrigatório anexar um arquivo válido.');
    }

    if (file.size > DocumentsService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('O arquivo excede o tamanho máximo permitido de 10 MB.');
    }

    const extension = this.extractExtension(file.originalname);
    if (!DocumentsService.ALLOWED_EXTENSIONS.includes(extension)) {
      throw new BadRequestException(
        `Formato de arquivo "${extension}" não suportado. Envie PDF, DOC, DOCX, TXT, CSV, MD ou Imagem (PNG, JPG, WEBP).`,
      );
    }
  }

  private extractExtension(filename: string): string {
    const ext = extname(filename).toLowerCase();
    return ext || '.txt';
  }
}
