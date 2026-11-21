import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'Título de exibição do documento.',
    example: 'Contrato de Prestação de Serviços.pdf',
    maxLength: 160,
  })
  @IsString({ message: 'O título deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O título do documento é obrigatório.' })
  @MaxLength(160, { message: 'O título deve ter no máximo 160 caracteres.' })
  title!: string;

  @ApiProperty({
    description: 'Instrução que será enviada junto com o conteúdo do documento ao modelo GPT-4o-mini.',
    example: 'Resuma as principais cláusulas, prazos e multas rescisórias deste contrato.',
    maxLength: 4000,
  })
  @IsString({ message: 'A instrução para a IA deve ser um texto válido.' })
  @IsNotEmpty({ message: 'A instrução para a IA é obrigatória.' })
  @MaxLength(4000, { message: 'A instrução para a IA deve ter no máximo 4000 caracteres.' })
  instruction!: string;
}
