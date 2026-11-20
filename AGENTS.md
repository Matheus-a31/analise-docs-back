# Backend Repository Rules — Jus Digital

Always follow the `solid-clean-code` skill in `.agents/skills/solid-clean-code/SKILL.md`:
- Enforce SOLID principles (SRP, OCP, LSP, ISP, DIP) across all NestJS modules.
- Use strict TypeScript typing (zero `any`).
- Keep controllers thin, business logic in services, and external integrations (AWS S3, OpenAI `gpt-4o-mini`, Prisma) behind injected interfaces.
- Never commit `.env` files or expose API keys/tokens in tracked files.
