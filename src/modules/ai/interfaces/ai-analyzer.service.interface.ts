export const AI_ANALYZER_SERVICE = Symbol('AI_ANALYZER_SERVICE');

export interface AnalyzeDocumentInput {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  title: string;
  instruction: string;
}

export interface IAiAnalyzerService {
  analyzeDocument(input: AnalyzeDocumentInput): Promise<string>;
}
