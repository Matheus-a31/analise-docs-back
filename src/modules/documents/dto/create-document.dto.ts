import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString({ message: 'O título deve ser um texto válido.' })
  @IsNotEmpty({ message: 'O título do documento é obrigatório.' })
  @MaxLength(160, { message: 'O título deve ter no máximo 160 caracteres.' })
  title!: string;

  @IsString({ message: 'A instrução para a IA deve ser um texto válido.' })
  @IsNotEmpty({ message: 'A instrução para a IA é obrigatória.' })
  @MaxLength(4000, { message: 'A instrução para a IA deve ter no máximo 4000 caracteres.' })
  instruction!: string;
}
