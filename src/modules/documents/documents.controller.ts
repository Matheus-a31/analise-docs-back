import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  DocumentResponseDto,
  DocumentsService,
  UploadedFilePayload,
} from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DeleteDocumentsDto } from './dto/delete-documents.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.createAndAnalyze(user.id, file, dto);
  }

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<DocumentResponseDto[]> {
    return this.documentsService.findAllByUser(user.id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findOneByUser(id, user.id);
  }

  @Post(':id/retry-analysis')
  @HttpCode(HttpStatus.OK)
  async retryAnalysis(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.retryAnalysis(id, user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async removeMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteDocumentsDto,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    return this.documentsService.removeMany(dto.ids, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async removeOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    return this.documentsService.removeMany([id], user.id);
  }
}
