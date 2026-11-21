import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentSwaggerDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Contrato de Prestação de Serviços.pdf' })
  title!: string;

  @ApiProperty({ example: 'Contrato.pdf' })
  originalName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: '.pdf' })
  extension!: string;

  @ApiProperty({ example: 34816, description: 'Tamanho do arquivo em bytes.' })
  sizeBytes!: number;

  @ApiProperty({ example: 'documents/user-id/1732150000-uuid-Contrato.pdf' })
  s3Key!: string;

  @ApiProperty({ example: 'https://jus-desafio.s3.us-east-2.amazonaws.com/documents/...' })
  s3Url!: string;

  @ApiProperty({
    description: 'URL pré-assinada temporária da AWS S3 (válida por 1 hora) para visualização/download seguro.',
    example: 'https://jus-desafio.s3.us-east-2.amazonaws.com/documents/...?X-Amz-Signature=...',
  })
  downloadUrl!: string;

  @ApiProperty({
    example: 'Resuma as cláusulas de rescisão e multas contratuais.',
  })
  instruction!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Resposta gerada pelo modelo OpenAI gpt-4o-mini.',
    example: 'O contrato prevê rescisão mediante aviso prévio de 30 dias e multa de 10%.',
  })
  aiAnalysis!: string | null;

  @ApiProperty({
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    example: 'COMPLETED',
  })
  analysisStatus!: 'PENDING' | 'COMPLETED' | 'FAILED';

  @ApiPropertyOptional({
    nullable: true,
    description: 'Mensagem de erro caso a chamada à IA tenha falhado (permite retry posterior).',
    example: null,
  })
  errorMessage!: string | null;

  @ApiProperty({ example: '7b9e6c1a-4d2f-4e8a-9b3c-1234567890ab' })
  userId!: string;

  @ApiProperty({ example: '2026-11-21T01:20:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-11-21T01:20:05.000Z' })
  updatedAt!: Date;
}

export class DeleteDocumentsResponseSwaggerDto {
  @ApiProperty({ example: 2, description: 'Quantidade de documentos removidos com sucesso.' })
  deletedCount!: number;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Lista de IDs dos documentos removidos.',
  })
  deletedIds!: string[];
}
