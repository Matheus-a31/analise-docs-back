export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface UploadFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  userId: string;
}

export interface UploadFileResult {
  key: string;
  url: string;
}

export interface IStorageService {
  uploadFile(input: UploadFileInput): Promise<UploadFileResult>;
  getFileBuffer(key: string): Promise<Buffer>;
  getSignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
  deleteFiles(keys: string[]): Promise<void>;
}
