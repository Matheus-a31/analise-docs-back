import { BadRequestException } from '@nestjs/common';
import { DocumentTextExtractorService } from './document-text-extractor.service';

describe('DocumentTextExtractorService', () => {
  let extractor: DocumentTextExtractorService;

  beforeEach(() => {
    extractor = new DocumentTextExtractorService();
  });

  it('deve extrair texto de arquivos texto/doc simples', async () => {
    const buffer = Buffer.from('Cláusula 1: Objeto do contrato de prestação de serviços.', 'utf-8');
    const result = await extractor.extract(buffer, 'text/plain', 'Contrato.txt');

    expect(result.mode).toBe('text');
    expect(result.text).toContain('Cláusula 1: Objeto do contrato');
  });

  it('deve retornar modo image com Data URL base64 para imagens', async () => {
    const buffer = Buffer.from('fake-png-bytes');
    const result = await extractor.extract(buffer, 'image/png', 'comprovante.png');

    expect(result.mode).toBe('image');
    expect(result.imageDataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('deve lançar BadRequestException quando o buffer estiver vazio', async () => {
    await expect(
      extractor.extract(Buffer.alloc(0), 'text/plain', 'vazio.txt'),
    ).rejects.toThrow(BadRequestException);
  });
});
