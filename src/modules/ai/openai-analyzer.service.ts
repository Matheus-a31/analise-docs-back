import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  GatewayTimeoutException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  IAiAnalyzerService,
  AnalyzeDocumentInput,
} from './interfaces/ai-analyzer.service.interface';
import { DocumentTextExtractorService } from './document-text-extractor.service';

@Injectable()
export class OpenAiAnalyzerService implements IAiAnalyzerService {
  private readonly logger = new Logger(OpenAiAnalyzerService.name);
  private readonly openai: OpenAI;
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly textExtractor: DocumentTextExtractorService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');

    this.openai = new OpenAI({
      apiKey: apiKey || 'missing-api-key',
      timeout: 35000,
      maxRetries: 1,
    });
  }

  async analyzeDocument(input: AnalyzeDocumentInput): Promise<string> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'A chave OPENAI_API_KEY não está configurada no servidor.',
      );
    }

    const extracted = await this.textExtractor.extract(
      input.buffer,
      input.mimeType,
      input.originalName,
    );

    const systemPrompt = [
      'Você é um assistente jurídico e analista documental especializado da Jus Digital.',
      'Sua tarefa é analisar com precisão o documento fornecido pelo usuário e responder exatamente à instrução solicitada.',
      'Responda em português claro, objetivo, bem estruturado e profissional.',
    ].join(' ');

    try {
      const userMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
        extracted.mode === 'image' && extracted.imageDataUrl
          ? [
              {
                type: 'text',
                text: `Título do Documento: "${input.title}" (${input.originalName})\nInstrução para análise: ${input.instruction}`,
              },
              {
                type: 'image_url',
                image_url: { url: extracted.imageDataUrl, detail: 'auto' },
              },
            ]
          : [
              {
                type: 'text',
                text: [
                  `Título do Documento: "${input.title}" (${input.originalName})`,
                  `Instrução do Usuário: ${input.instruction}`,
                  '--- CONTEÚDO DO DOCUMENTO ---',
                  extracted.text || '',
                ].join('\n\n'),
              },
            ];

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessages },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const responseText = completion.choices[0]?.message?.content?.trim();
      if (!responseText) {
        throw new ServiceUnavailableException(
          'A OpenAI não retornou conteúdo para a análise deste documento.',
        );
      }

      return responseText;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException ||
        error instanceof GatewayTimeoutException
      ) {
        throw error;
      }

      this.logger.error('Erro na chamada ao OpenAI GPT-4o-mini:', error);

      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new GatewayTimeoutException(
          'Tempo limite excedido ao aguardar resposta do GPT-4o-mini. Tente novamente.',
        );
      }

      if (error instanceof OpenAI.RateLimitError) {
        throw new ServiceUnavailableException(
          'Limite de uso da API da OpenAI atingido no momento. Aguarde alguns instantes e tente novamente.',
        );
      }

      if (error instanceof OpenAI.AuthenticationError) {
        throw new ServiceUnavailableException(
          'Falha de autenticação com a API da OpenAI. Verifique o token configurado no back-end.',
        );
      }

      throw new ServiceUnavailableException(
        'Ocorreu um erro ao processar a análise com a IA (GPT-4o-mini). Você pode tentar novamente.',
      );
    }
  }
}
