import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DeleteDocumentsDto {
  @ApiProperty({
    description: 'Lista de IDs (UUID) dos documentos a serem excluídos simultaneamente da AWS S3 e do PostgreSQL.',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray({ message: 'A lista de IDs deve ser um array.' })
  @ArrayNotEmpty({ message: 'Selecione ao menos um documento para excluir.' })
  @IsString({ each: true, message: 'Cada ID de documento deve ser uma string válida.' })
  ids!: string[];
}
