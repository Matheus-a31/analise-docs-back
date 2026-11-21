# Jus Digital — Back-end API (Desafio Técnico FullStack)

API RESTful desenvolvida em **NestJS + TypeScript + Prisma ORM + PostgreSQL**, responsável pela autenticação via **Google OAuth 2.0**, armazenamento seguro de documentos originais na **AWS S3** e pipeline de análise inteligente com **OpenAI (`gpt-4o-mini`)**.

---

## Sumário
1. [Arquitetura e Decisões Técnicas (SOLID)](#1-arquitetura-e-decisões-técnicas-solid)
2. [Stack Tecnológica](#2-stack-tecnológica)
3. [Modelagem de Dados](#3-modelagem-de-dados)
4. [Segurança e Variáveis de Ambiente](#4-segurança-e-variáveis-de-ambiente)
5. [Como Configurar Google OAuth e AWS S3 (ou Terraform)](#5-como-configurar-google-oauth-e-aws-s3-ou-terraform)
6. [Como Rodar o Projeto](#6-como-rodar-o-projeto)
7. [Testes Automatizados](#7-testes-automatizados)
8. [Endpoints da API](#8-endpoints-da-api)

---

## 1. Arquitetura e Decisões Técnicas (SOLID)

A aplicação foi projetada aplicando os princípios **SOLID** e **Clean Code**:

- **S — Single Responsibility Principle (Responsabilidade Única)**:
  - `Controllers` (`AuthController`, `DocumentsController`) cuidam exclusivamente de roteamento HTTP, parsing de multipart e validação de DTOs.
  - `DocumentsService` orquestra o caso de uso de upload, análise, retry e exclusão.
  - `DocumentTextExtractorService` possui a responsabilidade única de extrair texto legível de PDFs (`pdf-parse`), documentos Word `.doc`/`.docx` (`mammoth`) e converter imagens para visão computacional (Base64 Data URL).
  - `OpenAiAnalyzerService` encapsula a comunicação e o tratamento de falhas com o modelo `gpt-4o-mini`.
  - `S3StorageService` encapsula o envio, geração de URLs assinadas e exclusão em lote de objetos na AWS S3.
- **O / L — Open/Closed & Liskov Substitution**:
  - Os contratos `IStorageService`, `IAiAnalyzerService` e `IDocumentRepository` permitem substituir implementações (ex: AWS S3 real vs MinIO S3 local em desenvolvimento, ou Mocks nos testes E2E) sem alterar uma linha de regra de negócio.
- **I — Interface Segregation**:
  - DTOs enxutos e validados com `class-validator` (`CreateDocumentDto`, `DeleteDocumentsDto`, `GoogleAuthDto`).
- **D — Dependency Inversion**:
  - `DocumentsService` depende apenas das abstrações injetadas via tokens (`DOCUMENT_REPOSITORY`, `STORAGE_SERVICE`, `AI_ANALYZER_SERVICE`).

### Por que PostgreSQL + Prisma ORM?
- **Tipagem Estrita Ponta a Ponta**: O Prisma gera tipos TypeScript 100% sincronizados com o schema do banco (`schema.prisma`), eliminando erros de runtime e garantindo segurança em tempo de compilação.
- **Separação Clara**: O arquivo original fica armazenado na **AWS S3**, enquanto os metadados (`title`, `instruction`, `aiAnalysis`, `s3Key`, `s3Url`, `sizeBytes`, `analysisStatus`) ficam persistidos no **PostgreSQL**.

---

## 2. Stack Tecnológica

- **Framework**: NestJS 10 (Node.js + TypeScript)
- **Banco de Dados & ORM**: PostgreSQL 16 + Prisma ORM 6
- **Armazenamento de Arquivos**: AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`)
- **Inteligência Artificial**: OpenAI SDK oficial (`gpt-4o-mini`)
- **Autenticação**: Google OAuth 2.0 (`google-auth-library`) + JWT (`@nestjs/jwt` / `passport-jwt`)
- **Extração de Documentos**: `pdf-parse` (PDF), `mammoth` (DOCX/DOC), UTF-8 Text e Vision multimodal (PNG/JPG/WEBP)
- **Qualidade & Infra**: Jest + Supertest, Docker & Docker Compose, Terraform (IaC) e GitHub Actions (CI)

---

## 3. Modelagem de Dados

Definida em `prisma/schema.prisma`:
- **`User` (`users`)**: `id`, `email`, `name`, `picture`, `googleId`, `createdAt`, `updatedAt`.
- **`Document` (`documents`)**: `id`, `title`, `originalName`, `mimeType`, `extension`, `sizeBytes`, `s3Key`, `s3Url`, `instruction`, `aiAnalysis`, `analysisStatus` (`PENDING` | `COMPLETED` | `FAILED`), `errorMessage`, `userId`, `createdAt`, `updatedAt`.

---

## 4. Segurança e Variáveis de Ambiente

- **Nenhuma chave ou token é exposto no repositório ou no front-end.**
- Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Preencha as variáveis no `.env`:
- `OPENAI_API_KEY`: Token da OpenAI fornecido para o desafio.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Credenciais OAuth 2.0 criadas no Google Cloud Console.
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`: Credenciais do bucket AWS S3.

---

## 5. Como Configurar Google OAuth e AWS S3 (ou Terraform)

### 5.1. Google Cloud Console (OAuth 2.0)
1. Acesse o [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e vá em **APIs e Serviços > Tela de permissão OAuth** (configure como *Externo* e adicione seu e-mail como usuário de teste).
2. Vá em **Credenciais > Criar Credenciais > ID do cliente OAuth** (Tipo: *Aplicativo da Web*).
3. Em **Origens JavaScript autorizadas**, adicione `http://localhost:5173`.
4. Copie o **Client ID** para `GOOGLE_CLIENT_ID` no `backend/.env` (e para `VITE_GOOGLE_CLIENT_ID` no `frontend/.env`).

> **Nota para Teste Rápido Local**: Enquanto `ENABLE_DEV_LOGIN="true"` estiver ativo em ambiente de desenvolvimento (`NODE_ENV=development`), a tela de login também permite entrar com 1 clique usando o perfil de demonstração do protótipo (*Dra. Mariana Gomes*).

### 5.2. AWS S3 via Terraform (IaC) ou Console
Para provisionar automaticamente o bucket S3 privado com criptografia AES256, CORS e usuário IAM de privilégio mínimo usando **Terraform**:

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edite bucket_name em terraform.tfvars com um nome único
terraform init
terraform apply
```

Ao final do desafio, para desativar os recursos criados na nuvem (conforme orientação do desafio):
```bash
terraform destroy
```

---

## 6. Como Rodar o Projeto

### Opção A: Via Docker Compose (PostgreSQL + API)
```bash
docker compose up -d --build
```
Isso iniciará:
- **PostgreSQL** na porta `5433` (mapeado em `5433:5432` para evitar conflito com instalações locais na porta `5432`)
- **API NestJS** em `http://localhost:3000/api`

### Opção B: Rodando a API localmente com Node.js (e Postgres no Docker)
```bash
# 1. Suba apenas o banco Postgres no Docker
docker compose up -d postgres

# 2. Instale as dependências e sincronize o schema do Prisma
npm install
npx prisma db push

# 3. Inicie o servidor em modo watch
npm run start:dev
```

---

## 6. Testes Automatizados

```bash
# Testes Unitários (DocumentsService, AuthService, DocumentTextExtractorService)
npm run test

# Testes de Integração / E2E (Rotas HTTP + Guards + Uploads)
npm run test:e2e
```

---

## 8. Endpoints da API & Documentação Swagger

A documentação interativa OpenAPI/Swagger está disponível em:
- **Local**: `http://localhost:3000/api/docs`
- **Produção (AWS EC2)**: `https://3.143.230.43.sslip.io/api/docs`

| Método | Rota | Descrição | Autenticação |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/docs` | Interface interativa Swagger (OpenAPI 3.0) | Pública |
| `GET` | `/api/health` | Healthcheck do serviço | Pública |
| `POST` | `/api/auth/google` | Login/Cadastro com token Google OAuth 2.0 | Pública |
| `POST` | `/api/auth/dev-login` | Login rápido de desenvolvimento (`NODE_ENV !== 'production'`) | Pública (Dev) |
| `GET` | `/api/auth/me` | Retorna perfil (foto, nome e e-mail) do usuário logado | Bearer JWT |
| `POST` | `/api/documents` | Upload (`multipart/form-data`: `file`, `title`, `instruction`) + S3 + `gpt-4o-mini` | Bearer JWT |
| `GET` | `/api/documents` | Lista documentos do usuário autenticado | Bearer JWT |
| `GET` | `/api/documents/:id` | Retorna detalhes, análise da IA e URL assinada do S3 | Bearer JWT |
| `POST` | `/api/documents/:id/retry-analysis` | Reprocessa a análise no `gpt-4o-mini` em caso de erro anterior | Bearer JWT |
| `DELETE` | `/api/documents` | Exclui 1 ou múltiplos documentos (`{ "ids": ["..."] }`) do S3 e do BD | Bearer JWT |

---

## 9. Deploy em Produção na AWS EC2 (Docker + Caddy HTTPS + GitHub Actions)

O repositório já inclui o workflow `.github/workflows/deploy-ec2.yml`, `docker-compose.prod.yml` e `Caddyfile` para deploy contínuo na AWS EC2 (Free Tier `t2.micro`/`t3.micro`) com **HTTPS automático via Let's Encrypt + `sslip.io`**.

### Secrets necessários no GitHub Actions (`Settings > Secrets and variables > Actions`)
- `EC2_HOST`: `ec2-3-143-230-43.us-east-2.compute.amazonaws.com` (ou IP público)
- `EC2_USER`: `ec2-user`
- `EC2_SSH_KEY`: conteúdo completo da chave privada `.pem`
- `API_DOMAIN`: `<IP_EC2>.sslip.io` (ex: `3.143.230.43.sslip.io`)
- `FRONTEND_URL`: URL da Vercel (ex: `https://seu-app.vercel.app`)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OPENAI_API_KEY`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

> **Security Group da EC2**: garanta que as portas `22` (SSH), `80` (HTTP - validação Let's Encrypt) e `443` (HTTPS) estejam abertas para `0.0.0.0/0`.

"# analise-docs-back" 
