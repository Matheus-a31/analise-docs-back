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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
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
import {
  DeleteDocumentsResponseSwaggerDto,
  DocumentSwaggerDto,
} from './dto/document-response.dto';

@ApiTags('Documents')
@ApiBearerAuth('JWT-auth')
@ApiUnauthorizedResponse({ description: 'Token JWT ausente, inválido ou expirado.' })
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Anexar documento e analisar com IA (GPT-4o-mini)',
    description:
      'Faz upload do arquivo original para a AWS S3 (até 10 MB; formatos PDF, DOC, DOCX, TXT, CSV, MD, JSON, PNG, JPG, WEBP), extrai o texto ou envia imagem multimodal ao GPT-4o-mini com a instrução fornecida e salva os metadados e a análise no PostgreSQL.',
  })
  @ApiBody({
    description: 'Formulário multipart contendo o arquivo binário, título e instrução para IA.',
    schema: {
      type: 'object',
      required: ['file', 'title', 'instruction'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo original a ser armazenado na AWS S3 e analisado.',
        },
        title: {
          type: 'string',
          example: 'Contrato Social.pdf',
          description: 'Título de exibição do documento.',
        },
        instruction: {
          type: 'string',
          example: 'Resuma o objeto social, sócios e cláusulas de administração.',
          description: 'Instrução sobre como a IA deve analisar este documento.',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Documento salvo na AWS S3 e processado pela IA com sucesso.',
    type: DocumentSwaggerDto,
  })
  @ApiBadRequestResponse({
    description: 'Arquivo ausente, formato não suportado, limite de 10 MB excedido ou campos obrigatórios inválidos.',
  })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFilePayload | undefined,
    @Body() dto: CreateDocumentDto,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.createAndAnalyze(user.id, file, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar documentos do usuário autenticado',
    description:
      'Retorna todos os documentos enviados pelo usuário logado, ordenados do mais recente para o mais antigo, com URL assinada temporária do S3.',
  })
  @ApiOkResponse({
    description: 'Lista de documentos retornada com sucesso.',
    type: [DocumentSwaggerDto],
  })
  async findAll(@CurrentUser() user: AuthenticatedUser): Promise<DocumentResponseDto[]> {
    return this.documentsService.findAllByUser(user.id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obter detalhes e análise da IA de um documento',
    description: 'Retorna os metadados, a análise gerada pelo GPT-4o-mini e o link assinado do arquivo na AWS S3.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do documento.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Detalhes do documento retornados com sucesso.',
    type: DocumentSwaggerDto,
  })
  @ApiNotFoundResponse({ description: 'Documento não encontrado para o usuário autenticado.' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findOneByUser(id, user.id);
  }

  @Post(':id/retry-analysis')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprocessar análise da IA de um documento',
    description:
      'Recupera o arquivo original armazenado na AWS S3 e reenvia ao modelo GPT-4o-mini caso a análise anterior tenha falhado por timeout ou limite de uso.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do documento a ser reanalisado.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Análise reprocessada e atualizada com sucesso.',
    type: DocumentSwaggerDto,
  })
  @ApiNotFoundResponse({ description: 'Documento não encontrado.' })
  async retryAnalysis(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.retryAnalysis(id, user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Excluir um ou múltiplos documentos em lote',
    description:
      'Remove permanentemente os arquivos originais do bucket AWS S3 e seus respectivos registros e análises do PostgreSQL.',
  })
  @ApiOkResponse({
    description: 'Documentos excluídos com sucesso.',
    type: DeleteDocumentsResponseSwaggerDto,
  })
  @ApiBadRequestResponse({ description: 'Lista de IDs vazia ou inválida.' })
  @ApiNotFoundResponse({ description: 'Nenhum dos documentos informados foi encontrado.' })
  async removeMany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteDocumentsDto,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    return this.documentsService.removeMany(dto.ids, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Excluir um único documento por ID',
    description: 'Remove o arquivo original da AWS S3 e o registro correspondente no PostgreSQL.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do documento a excluir.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiOkResponse({
    description: 'Documento excluído com sucesso.',
    type: DeleteDocumentsResponseSwaggerDto,
  })
  @ApiNotFoundResponse({ description: 'Documento não encontrado.' })
  async removeOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ deletedCount: number; deletedIds: string[] }> {
    return this.documentsService.removeMany([id], user.id);
  }
}
