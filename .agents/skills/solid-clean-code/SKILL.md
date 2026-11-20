---
name: solid-clean-code
description: >-
  Enforces SOLID principles, Clean Code, strict TypeScript typing, and simple maintainable architecture
  in the Backend (NestJS + Prisma + PostgreSQL). Always activate and follow when writing, refactoring,
  or reviewing backend code.
---

# SOLID & Clean Code Guidelines (Backend — NestJS & Prisma)

1. **Single Responsibility Principle (SRP)**:
   - `Controller`: Handles HTTP routing, request parsing, status codes, and DTO validation only.
   - `Service`: Orchestrates domain business logic.
   - `Adapter / Extractor`: Separate services for file text extraction (`DocumentTextExtractorService`), cloud storage (`S3StorageService`), and AI analysis (`OpenAiAnalyzerService`).
   - `Repository`: Isolates Prisma database operations (`PrismaDocumentRepository`).
2. **Open/Closed (OCP) & Liskov Substitution (LSP)**:
   - Define `IStorageService`, `IAiAnalyzerService`, and `IDocumentRepository` interfaces so implementations can be swapped or mocked without changing domain services.
3. **Interface Segregation (ISP)**:
   - Keep DTOs (`CreateDocumentDto`, `DeleteDocumentsDto`) and interfaces lean and specific to their operation.
4. **Dependency Inversion (DIP)**:
   - Inject abstractions via custom tokens (`STORAGE_SERVICE`, `AI_ANALYZER_SERVICE`, `DOCUMENT_REPOSITORY`).
5. **Clean Code & Security**:
   - Strict TypeScript (no `any`), small focused methods, guard clauses, descriptive error handling, and zero secrets in code.
