import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname, join, dirname } from 'path';
import { promises as fs } from 'fs';
import {
  IStorageService,
  UploadFileInput,
  UploadFileResult,
} from './interfaces/storage.service.interface';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly useLocalDevFallback: boolean;
  private readonly localBucketDir: string;

  constructor(private readonly configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1').trim();
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET', 'jus-digital-documents').trim();
    this.endpoint = this.configService.get<string>('AWS_S3_ENDPOINT')?.trim() || undefined;

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID', '').trim();
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY', '').trim();
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    this.useLocalDevFallback =
      nodeEnv !== 'production' &&
      (!accessKeyId ||
        !secretAccessKey ||
        accessKeyId === 'your-aws-access-key-id' ||
        accessKeyId === 'minioadmin');

    this.localBucketDir = join(process.cwd(), '.local-s3-bucket');

    const forcePathStyle =
      this.configService.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true' ||
      Boolean(this.endpoint);

    this.s3Client = new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId: accessKeyId || 'local-fallback-key',
        secretAccessKey: secretAccessKey || 'local-fallback-secret',
      },
    });

    if (this.useLocalDevFallback) {
      this.logger.log(
        'Modo Dev S3 Fallback ativo: arquivos serão salvos em .local-s3-bucket/ até que AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY reais sejam configurados no .env.',
      );
    }
  }

  async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
    const extension = extname(input.originalName).toLowerCase();
    const sanitizedBase = input.originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    const key = `documents/${input.userId}/${Date.now()}-${randomUUID()}-${sanitizedBase}${extension}`;

    if (this.useLocalDevFallback) {
      return this.uploadToLocalFallback(key, input.buffer);
    }

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: input.buffer,
          ContentType: input.mimeType,
        }),
      );

      const url = this.endpoint
        ? `${this.endpoint.replace(/\/$/, '')}/${this.bucketName}/${key}`
        : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return { key, url };
    } catch (error) {
      this.logger.error(`Erro ao enviar arquivo para o AWS S3 (key: ${key}):`, error);
      throw new InternalServerErrorException(
        'Não foi possível armazenar o arquivo na AWS S3. Verifique as credenciais e o bucket configurado.',
      );
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    if (this.useLocalDevFallback) {
      const filePath = join(this.localBucketDir, key);
      return fs.readFile(filePath);
    }

    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new Error('Corpo do objeto S3 vazio.');
      }

      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (error) {
      this.logger.error(`Erro ao baixar arquivo do S3 (key: ${key}):`, error);
      throw new InternalServerErrorException(
        'Não foi possível recuperar o arquivo original na AWS S3.',
      );
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.useLocalDevFallback) {
      return '';
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    } catch (error) {
      this.logger.warn(`Falha ao gerar URL assinada para ${key}:`, error);
      return '';
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useLocalDevFallback) {
      await this.deleteFromLocalFallback(key);
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.error(`Erro ao excluir arquivo do S3 (key: ${key}):`, error);
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    if (this.useLocalDevFallback) {
      await Promise.all(keys.map((key) => this.deleteFromLocalFallback(key)));
      return;
    }

    try {
      await this.s3Client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucketName,
          Delete: {
            Objects: keys.map((key) => ({ Key: key })),
            Quiet: true,
          },
        }),
      );
    } catch (error) {
      this.logger.error(`Erro ao excluir múltiplos arquivos do S3:`, error);
    }
  }

  private async uploadToLocalFallback(key: string, buffer: Buffer): Promise<UploadFileResult> {
    const filePath = join(this.localBucketDir, key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return {
      key,
      url: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`,
    };
  }

  private async deleteFromLocalFallback(key: string): Promise<void> {
    try {
      const filePath = join(this.localBucketDir, key);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file already removed
    }
  }
}
