import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { extname } from 'path';

export interface ExtractedDocumentContent {
  mode: 'text' | 'image';
  text?: string;
  imageDataUrl?: string;
}

@Injectable()
export class DocumentTextExtractorService {
  private readonly logger = new Logger(DocumentTextExtractorService.name);
  private static readonly MAX_EXTRACTED_CHARS = 35000;

  async extract(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
  ): Promise<ExtractedDocumentContent> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('O arquivo enviado está vazio.');
    }

    const extension = extname(originalName).toLowerCase();
    const normalizedMime = (mimeType || '').toLowerCase();

    if (this.isImage(normalizedMime, extension)) {
      const safeMime = normalizedMime.startsWith('image/') ? normalizedMime : 'image/png';
      return {
        mode: 'image',
        imageDataUrl: `data:${safeMime};base64,${buffer.toString('base64')}`,
      };
    }

    if (normalizedMime === 'application/pdf' || extension === '.pdf') {
      return this.extractFromPdf(buffer);
    }

    if (
      normalizedMime.includes('wordprocessingml') ||
      extension === '.docx'
    ) {
      return this.extractFromDocx(buffer);
    }

    if (normalizedMime === 'application/msword' || extension === '.doc') {
      return this.extractFromLegacyDoc(buffer);
    }

    return this.extractFromPlainText(buffer);
  }

  private isImage(mimeType: string, extension: string): boolean {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    return mimeType.startsWith('image/') || imageExtensions.includes(extension);
  }

  private async extractFromPdf(buffer: Buffer): Promise<ExtractedDocumentContent> {
    try {
      const parsed = await pdfParse(buffer);
      const cleaned = this.cleanAndTruncate(parsed.text || '');
      if (!cleaned) {
        throw new BadRequestException(
          'Não foi possível extrair texto legível deste PDF (o documento pode estar protegido ou conter apenas páginas digitalizadas sem OCR).',
        );
      }
      return { mode: 'text', text: cleaned };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.warn('Falha ao processar PDF via pdf-parse, tentando fallback textual:', error);
      const fallback = this.extractPrintableAsciiOrUtf8(buffer);
      if (fallback.length >= 20) {
        return { mode: 'text', text: fallback };
      }
      throw new BadRequestException('O arquivo PDF enviado está corrompido ou ilegível.');
    }
  }

  private async extractFromDocx(buffer: Buffer): Promise<ExtractedDocumentContent> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const cleaned = this.cleanAndTruncate(result.value || '');
      if (!cleaned) {
        throw new BadRequestException('O documento Word (.docx) não possui texto legível.');
      }
      return { mode: 'text', text: cleaned };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const fallback = this.extractPrintableAsciiOrUtf8(buffer);
      if (fallback.length >= 10) {
        return { mode: 'text', text: fallback };
      }
      throw new BadRequestException('Não foi possível ler o conteúdo do arquivo Word (.docx).');
    }
  }

  private async extractFromLegacyDoc(buffer: Buffer): Promise<ExtractedDocumentContent> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const cleaned = this.cleanAndTruncate(result.value || '');
      if (cleaned) {
        return { mode: 'text', text: cleaned };
      }
    } catch {
      // Legacy binary .doc or plain text saved as .doc falls back below
    }

    const extracted = this.extractPrintableAsciiOrUtf8(buffer);
    if (!extracted) {
      throw new BadRequestException('O arquivo .doc enviado está vazio ou ilegível.');
    }
    return { mode: 'text', text: extracted };
  }

  private extractFromPlainText(buffer: Buffer): ExtractedDocumentContent {
    const raw = buffer.toString('utf-8');
    const cleaned = this.cleanAndTruncate(raw);
    if (!cleaned) {
      throw new BadRequestException('Não foi possível extrair conteúdo textual do arquivo enviado.');
    }
    return { mode: 'text', text: cleaned };
  }

  private extractPrintableAsciiOrUtf8(buffer: Buffer): string {
    const rawUtf8 = buffer.toString('utf-8');
    const printable = rawUtf8
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return this.cleanAndTruncate(printable);
  }

  private cleanAndTruncate(text: string): string {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return normalized.slice(0, DocumentTextExtractorService.MAX_EXTRACTED_CHARS);
  }
}
