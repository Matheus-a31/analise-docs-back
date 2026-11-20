import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DeleteDocumentsDto {
  @IsArray({ message: 'A lista de IDs deve ser um array.' })
  @ArrayNotEmpty({ message: 'Selecione ao menos um documento para excluir.' })
  @IsString({ each: true, message: 'Cada ID de documento deve ser uma string válida.' })
  ids!: string[];
}
