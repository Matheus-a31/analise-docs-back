import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  DOCUMENT_REPOSITORY,
  IDocumentRepository,
} from '../src/modules/documents/interfaces/document.repository.interface';
import {
  IStorageService,
  STORAGE_SERVICE,
} from '../src/modules/storage/interfaces/storage.service.interface';
import {
  AI_ANALYZER_SERVICE,
  IAiAnalyzerService,
} from '../src/modules/ai/interfaces/ai-analyzer.service.interface';

describe('DocumentsController (Integration / E2E)', () => {
  let app: INestApplication;
  let jwtToken: string;

  const mockUser = {
    id: 'user-e2e-1',
    email: 'mariana@silvagomes.com',
    name: 'Dra. Mariana Gomes',
    picture: 'https://example.com/photo.jpg',
    googleId: 'google-123',
  };

  const mockDoc = {
    id: 'doc-e2e-1',
    title: 'Document.doc',
    originalName: 'Document.doc',
    mimeType: 'application/msword',
    extension: '.doc',
    sizeBytes: 34816,
    s3Key: 'documents/user-e2e-1/Document.doc',
    s3Url: 'https://s3.amazonaws.com/bucket/Document.doc',
    instruction: 'Resuma o documento',
    aiAnalysis: 'Resumo gerado pelo GPT-4o-mini.',
    analysisStatus: 'COMPLETED' as const,
    errorMessage: null,
    userId: mockUser.id,
    createdAt: new Date('2026-05-26T12:00:00Z'),
    updatedAt: new Date('2026-05-26T12:00:00Z'),
  };

  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser),
      upsert: jest.fn().mockResolvedValue(mockUser),
    },
  };

  const mockRepo: IDocumentRepository = {
    create: jest.fn().mockResolvedValue(mockDoc),
    findAllByUserId: jest.fn().mockResolvedValue([mockDoc]),
    findByIdAndUserId: jest.fn().mockResolvedValue(mockDoc),
    findManyByIdsAndUserId: jest.fn().mockResolvedValue([mockDoc]),
    updateAnalysis: jest.fn().mockResolvedValue(mockDoc),
    deleteManyByIdsAndUserId: jest.fn().mockResolvedValue(1),
  };

  const mockStorage: IStorageService = {
    uploadFile: jest.fn().mockResolvedValue({ key: mockDoc.s3Key, url: mockDoc.s3Url }),
    getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('Conteúdo de teste')),
    getSignedDownloadUrl: jest.fn().mockResolvedValue('https://signed-s3-url/Document.doc'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    deleteFiles: jest.fn().mockResolvedValue(undefined),
  };

  const mockAi: IAiAnalyzerService = {
    analyzeDocument: jest.fn().mockResolvedValue('Resumo gerado pelo GPT-4o-mini.'),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(DOCUMENT_REPOSITORY)
      .useValue(mockRepo)
      .overrideProvider(STORAGE_SERVICE)
      .useValue(mockStorage)
      .overrideProvider(AI_ANALYZER_SERVICE)
      .useValue(mockAi)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    const jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtToken = jwtService.sign({
      sub: mockUser.id,
      email: mockUser.email,
      name: mockUser.name,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health deve retornar status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/documents sem token deve retornar 401 Unauthorized', async () => {
    await request(app.getHttpServer()).get('/api/documents').expect(401);
  });

  it('POST /api/documents deve fazer upload, acionar IA e retornar o documento criado', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/documents')
      .set('Authorization', `Bearer ${jwtToken}`)
      .field('title', 'Document.doc')
      .field('instruction', 'Resuma o documento')
      .attach('file', Buffer.from('Conteúdo jurídico para análise'), 'Document.doc')
      .expect(201);

    expect(res.body.title).toBe('Document.doc');
    expect(res.body.aiAnalysis).toBe('Resumo gerado pelo GPT-4o-mini.');
    expect(res.body.downloadUrl).toBe('https://signed-s3-url/Document.doc');
  });

  it('GET /api/documents deve listar os documentos do usuário autenticado', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/documents')
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('doc-e2e-1');
  });

  it('DELETE /api/documents deve excluir documentos selecionados em lote', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/documents')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ ids: ['doc-e2e-1'] })
      .expect(200);

    expect(res.body.deletedCount).toBe(1);
  });
});
