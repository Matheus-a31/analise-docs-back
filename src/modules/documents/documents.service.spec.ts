import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service';
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

describe('DocumentsService', () => {
  let service: DocumentsService;
  let documentRepository: jest.Mocked<IDocumentRepository>;
  let storageService: jest.Mocked<IStorageService>;
  let aiAnalyzerService: jest.Mocked<IAiAnalyzerService>;

  const mockDocument: DocumentEntity = {
    id: 'doc-uuid-1',
    title: 'Contrato de Prestação de Serviços.pdf',
    originalName: 'Contrato.pdf',
    mimeType: 'application/pdf',
    extension: '.pdf',
    sizeBytes: 34816,
    s3Key: 'documents/user-1/123-Contrato.pdf',
    s3Url: 'https://bucket.s3.us-east-1.amazonaws.com/documents/user-1/123-Contrato.pdf',
    instruction: 'Resuma as cláusulas de rescisão e multa.',
    aiAnalysis: 'O contrato prevê multa rescisória de 10% sobre o saldo remanescente.',
    analysisStatus: 'COMPLETED',
    errorMessage: null,
    userId: 'user-1',
    createdAt: new Date('2026-05-26T10:00:00Z'),
    updatedAt: new Date('2026-05-26T10:00:00Z'),
  };

  beforeEach(async () => {
    documentRepository = {
      create: jest.fn(),
      findAllByUserId: jest.fn(),
      findByIdAndUserId: jest.fn(),
      findManyByIdsAndUserId: jest.fn(),
      updateAnalysis: jest.fn(),
      deleteManyByIdsAndUserId: jest.fn(),
    };

    storageService = {
      uploadFile: jest.fn(),
      getFileBuffer: jest.fn(),
      getSignedDownloadUrl: jest.fn(),
      deleteFile: jest.fn(),
      deleteFiles: jest.fn(),
    };

    aiAnalyzerService = {
      analyzeDocument: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: DOCUMENT_REPOSITORY, useValue: documentRepository },
        { provide: STORAGE_SERVICE, useValue: storageService },
        { provide: AI_ANALYZER_SERVICE, useValue: aiAnalyzerService },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  describe('createAndAnalyze', () => {
    it('deve fazer upload no S3, analisar com GPT-4o-mini e persistir o documento com sucesso', async () => {
      const file = {
        buffer: Buffer.from('Conteúdo do contrato jurídico'),
        originalname: 'Contrato.pdf',
        mimetype: 'application/pdf',
        size: 34816,
      };

      storageService.uploadFile.mockResolvedValue({
        key: mockDocument.s3Key,
        url: mockDocument.s3Url,
      });
      aiAnalyzerService.analyzeDocument.mockResolvedValue(mockDocument.aiAnalysis!);
      documentRepository.create.mockResolvedValue(mockDocument);
      storageService.getSignedDownloadUrl.mockResolvedValue('https://signed-url.com/file.pdf');

      const result = await service.createAndAnalyze('user-1', file, {
        title: mockDocument.title,
        instruction: mockDocument.instruction,
      });

      expect(storageService.uploadFile).toHaveBeenCalledWith({
        buffer: file.buffer,
        originalName: 'Contrato.pdf',
        mimeType: 'application/pdf',
        userId: 'user-1',
      });
      expect(aiAnalyzerService.analyzeDocument).toHaveBeenCalledWith({
        buffer: file.buffer,
        mimeType: 'application/pdf',
        originalName: 'Contrato.pdf',
        title: mockDocument.title,
        instruction: mockDocument.instruction,
      });
      expect(documentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: mockDocument.title,
          analysisStatus: 'COMPLETED',
          aiAnalysis: mockDocument.aiAnalysis,
        }),
      );
      expect(result.downloadUrl).toBe('https://signed-url.com/file.pdf');
    });

    it('deve salvar o documento com status FAILED quando a IA falhar, permitindo tentar novamente', async () => {
      const file = {
        buffer: Buffer.from('Texto válido'),
        originalname: 'Document.doc',
        mimetype: 'application/msword',
        size: 1024,
      };

      storageService.uploadFile.mockResolvedValue({
        key: 'documents/user-1/doc.doc',
        url: 'https://s3/doc.doc',
      });
      aiAnalyzerService.analyzeDocument.mockRejectedValue(
        new Error('Tempo limite excedido no GPT-4o-mini'),
      );
      documentRepository.create.mockResolvedValue({
        ...mockDocument,
        analysisStatus: 'FAILED',
        aiAnalysis: null,
        errorMessage: 'Tempo limite excedido no GPT-4o-mini',
      });
      storageService.getSignedDownloadUrl.mockResolvedValue('https://signed-url.com/doc.doc');

      const result = await service.createAndAnalyze('user-1', file, {
        title: 'Document.doc',
        instruction: 'Analise este arquivo',
      });

      expect(result.analysisStatus).toBe('FAILED');
      expect(result.errorMessage).toContain('Tempo limite excedido');
    });

    it('deve rejeitar arquivo vazio ou ausente', async () => {
      await expect(
        service.createAndAnalyze('user-1', undefined, {
          title: 'Doc',
          instruction: 'Instrução',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve rejeitar arquivo com extensão não suportada', async () => {
      const invalidFile = {
        buffer: Buffer.from('binary'),
        originalname: 'malware.exe',
        mimetype: 'application/octet-stream',
        size: 512,
      };

      await expect(
        service.createAndAnalyze('user-1', invalidFile, {
          title: 'Arquivo inválido',
          instruction: 'Instrução',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('retryAnalysis', () => {
    it('deve baixar o arquivo do S3, reprocessar no GPT-4o-mini e atualizar o status para COMPLETED', async () => {
      documentRepository.findByIdAndUserId.mockResolvedValue({
        ...mockDocument,
        analysisStatus: 'FAILED',
        aiAnalysis: null,
      });
      storageService.getFileBuffer.mockResolvedValue(Buffer.from('Conteúdo do contrato'));
      aiAnalyzerService.analyzeDocument.mockResolvedValue('Nova análise gerada com sucesso.');
      documentRepository.updateAnalysis.mockResolvedValue({
        ...mockDocument,
        aiAnalysis: 'Nova análise gerada com sucesso.',
        analysisStatus: 'COMPLETED',
        errorMessage: null,
      });
      storageService.getSignedDownloadUrl.mockResolvedValue('https://signed-url.com/file.pdf');

      const result = await service.retryAnalysis('doc-uuid-1', 'user-1');

      expect(storageService.getFileBuffer).toHaveBeenCalledWith(mockDocument.s3Key);
      expect(result.analysisStatus).toBe('COMPLETED');
      expect(result.aiAnalysis).toBe('Nova análise gerada com sucesso.');
    });
  });

  describe('removeMany', () => {
    it('deve excluir múltiplos documentos do S3 e do banco de dados', async () => {
      const doc2 = { ...mockDocument, id: 'doc-uuid-2', s3Key: 'documents/user-1/456.pdf' };
      documentRepository.findManyByIdsAndUserId.mockResolvedValue([mockDocument, doc2]);
      documentRepository.deleteManyByIdsAndUserId.mockResolvedValue(2);

      const result = await service.removeMany(['doc-uuid-1', 'doc-uuid-2'], 'user-1');

      expect(storageService.deleteFiles).toHaveBeenCalledWith([
        mockDocument.s3Key,
        doc2.s3Key,
      ]);
      expect(documentRepository.deleteManyByIdsAndUserId).toHaveBeenCalledWith(
        ['doc-uuid-1', 'doc-uuid-2'],
        'user-1',
      );
      expect(result).toEqual({
        deletedCount: 2,
        deletedIds: ['doc-uuid-1', 'doc-uuid-2'],
      });
    });

    it('deve lançar NotFoundException quando nenhum documento pertencer ao usuário', async () => {
      documentRepository.findManyByIdsAndUserId.mockResolvedValue([]);

      await expect(service.removeMany(['non-existent'], 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
