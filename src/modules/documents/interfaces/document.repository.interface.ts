import { AnalysisStatus } from '@prisma/client';

export const DOCUMENT_REPOSITORY = Symbol('DOCUMENT_REPOSITORY');

export interface DocumentEntity {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  s3Key: string;
  s3Url: string;
  instruction: string;
  aiAnalysis: string | null;
  analysisStatus: AnalysisStatus;
  errorMessage: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  title: string;
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  s3Key: string;
  s3Url: string;
  instruction: string;
  aiAnalysis: string | null;
  analysisStatus: AnalysisStatus;
  errorMessage?: string | null;
  userId: string;
}

export interface UpdateDocumentAnalysisInput {
  aiAnalysis: string | null;
  analysisStatus: AnalysisStatus;
  errorMessage: string | null;
}

export interface IDocumentRepository {
  create(data: CreateDocumentInput): Promise<DocumentEntity>;
  findAllByUserId(userId: string): Promise<DocumentEntity[]>;
  findByIdAndUserId(id: string, userId: string): Promise<DocumentEntity | null>;
  findManyByIdsAndUserId(ids: string[], userId: string): Promise<DocumentEntity[]>;
  updateAnalysis(id: string, data: UpdateDocumentAnalysisInput): Promise<DocumentEntity>;
  deleteManyByIdsAndUserId(ids: string[], userId: string): Promise<number>;
}
