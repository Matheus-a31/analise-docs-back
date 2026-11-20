import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from './interfaces/storage.service.interface';
import { S3StorageService } from './s3-storage.service';

@Module({
  providers: [
    S3StorageService,
    {
      provide: STORAGE_SERVICE,
      useExisting: S3StorageService,
    },
  ],
  exports: [STORAGE_SERVICE, S3StorageService],
})
export class StorageModule {}
