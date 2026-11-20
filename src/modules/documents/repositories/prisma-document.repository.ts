import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateDocumentInput,
  DocumentEntity,
  IDocumentRepository,
  UpdateDocumentAnalysisInput,
} from '../interfaces/document.repository.interface';

@Injectable()
export class PrismaDocumentRepository implements IDocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDocumentInput): Promise<DocumentEntity> {
    return this.prisma.document.create({
      data: {
        title: data.title,
        originalName: data.originalName,
        mimeType: data.mimeType,
        extension: data.extension,
        sizeBytes: data.sizeBytes,
        s3Key: data.s3Key,
        s3Url: data.s3Url,
        instruction: data.instruction,
        aiAnalysis: data.aiAnalysis,
        analysisStatus: data.analysisStatus,
        errorMessage: data.errorMessage ?? null,
        userId: data.userId,
      },
    });
  }

  async findAllByUserId(userId: string): Promise<DocumentEntity[]> {
    return this.prisma.document.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<DocumentEntity | null> {
    return this.prisma.document.findFirst({
      where: { id, userId },
    });
  }

  async findManyByIdsAndUserId(ids: string[], userId: string): Promise<DocumentEntity[]> {
    return this.prisma.document.findMany({
      where: {
        id: { in: ids },
        userId,
      },
    });
  }

  async updateAnalysis(id: string, data: UpdateDocumentAnalysisInput): Promise<DocumentEntity> {
    return this.prisma.document.update({
      where: { id },
      data: {
        aiAnalysis: data.aiAnalysis,
        analysisStatus: data.analysisStatus,
        errorMessage: data.errorMessage,
      },
    });
  }

  async deleteManyByIdsAndUserId(ids: string[], userId: string): Promise<number> {
    const result = await this.prisma.document.deleteMany({
      where: {
        id: { in: ids },
        userId,
      },
    });
    return result.count;
  }
}
