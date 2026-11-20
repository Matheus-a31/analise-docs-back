import { Module } from '@nestjs/common';
import { AI_ANALYZER_SERVICE } from './interfaces/ai-analyzer.service.interface';
import { DocumentTextExtractorService } from './document-text-extractor.service';
import { OpenAiAnalyzerService } from './openai-analyzer.service';

@Module({
  providers: [
    DocumentTextExtractorService,
    OpenAiAnalyzerService,
    {
      provide: AI_ANALYZER_SERVICE,
      useExisting: OpenAiAnalyzerService,
    },
  ],
  exports: [AI_ANALYZER_SERVICE, OpenAiAnalyzerService, DocumentTextExtractorService],
})
export class AiModule {}
