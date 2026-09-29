# CLAUDE.md — Prospector de Leads para Sites

## O que estamos construindo
Ferramenta que, dado um filtro (nicho, cidade/país, porte, orçamento ~US$500, idioma), encontra empresas SEM site (ou só com rede social / builder gratuito / domínio morto), pontua, enriquece contato, escreve um follow-up em rascunho, anexa 3 referências de site do nicho e grava tudo no CRM.

Dono do projeto: Ryan (estrategista web/PM, fala português). Responda ao Ryan em português; código, commits e nomes de variáveis em inglês.

## Base de código
- Fork do Prospex (`asiifdev/business-leads-ai-automation`, MIT) = aplicação principal. Monorepo pnpm + Turborepo: `apps/api` (NestJS), `apps/web` (Next.js), `packages/database` (Prisma/Postgres), `packages/types`, `packages/config`.
- `gosom/google-maps-scraper` (MIT, Go) = sidecar de descoberta, rodando em Docker e chamado via REST.
- Referências de código a PORTAR (todas MIT): `Aryanban/leadforge` (`backend/app/qualifier/scorer.py`, `signals.py`, `verifier/smtp_verifier.py`, `dedupe/`, `mcp_server.py`), `FAAQJAVED/Leadhunter_Pro` (`config.py` lista de domínios sociais, `enricher.py`), `omkarcloud/website-email-contact-scraper` (`src/contact_scraper`).
- Referências SÓ DE IDEIA, NUNCA copiar código: `mabdullahb/Locus` (AGPL-3.0), `geethikaisuru/business-website-classifier`, `dancolta/trustpilot-outreach-automation` (ambos sem licença).
- Os repos de referência ficam em `/vendor-ref/` (somente leitura, no .gitignore). Ao portar código MIT, manter o crédito no arquivo `THIRD_PARTY_NOTICES.md`.

## Regras inegociáveis
1. NUNCA enviar mensagem automaticamente. Follow-up é sempre rascunho (`status: "draft"`). O usuário copia ou abre no WhatsApp/e-mail.
2. Nenhum dado inventado. "Dono" só se vier de fonte pública, e todo contato tem `contactSource` e `ownerContactType` (`OWNER | BUSINESS | UNKNOWN`).
3. "Capital de US$500" NÃO é dado público: produzir `budgetScore` (0-100) a partir de sinais, exibido como "provável / incerto", nunca como fato.
4. Classificação "sem site" é determinística primeiro (regras), IA só para casos ambíguos. Sempre gravar `siteEvidence` (URL, status HTTP, motivo).
5. Segredos só em `.env` (nunca commitar). Manter `.env.example` atualizado.
6. Não baixar nem armazenar imagens do Pinterest ou de terceiros: guardar link + miniatura por URL e cache por nicho.
7. Scrapers de terceiros rodam em Docker isolado. Respeitar rate limit e `robots.txt` no crawl de sites de leads.
8. Cada fase termina com: testes passando, `pnpm lint`, `pnpm build`, e commit próprio. Não iniciar a fase seguinte sem eu (Ryan) aprovar.

## Comandos (confirmados na Fase 0)
- `pnpm install` · `pnpm build` · `pnpm dev` (turbo: api 3001, web 3000, marketing 3002)
- Banco: `pnpm --filter @prospex/database db:push` (dev) · `db:migrate` · `db:deploy` · `exec prisma generate`
- Typecheck: `pnpm --filter @prospex/api exec tsc --noEmit` e `pnpm --filter @prospex/web exec tsc --noEmit`
- Testes unitários: `pnpm test` (Vitest em apps/api, `src/**/*.spec.ts`). E2E Playwright: `pnpm test:e2e` (com api+web rodando).
- Smoke ponta a ponta: `DISCOVERY_DRIVER=mock node apps/api/dist/main` + `scripts/smoke.sh 100`.
- Lint: `pnpm lint` (eslint flat config em cada app; regras React-Compiler como warning).
- Descoberta: `DISCOVERY_DRIVER=gosom|places|playwright|mock` (ver .env.example).
- Env: copiar `.env.example` para `apps/api/.env` e `packages/database/.env` (JWT_SECRET, ENCRYPTION_KEY obrigatórios).
- Sem Docker (ambiente cloud): Postgres 16 e Redis nativos (`service postgresql start`, `redis-server --daemonize yes`).
- gosom: `docker compose -f infra/docker-compose.gosom.yml up -d` (REST em :8080). Binário local: `go build` em `vendor-ref/google-maps-scraper`.
- MCP: `pnpm --filter @prospex/mcp build` (apps/mcp). Guia de uso: `docs/PROSPECTOR.md`.
- E2E local: `PW_CHROMIUM_PATH=<chrome> THROTTLE_LIMIT=5000 AUTH_THROTTLE_LIMIT=5000 scripts/restart-api.sh` + `next start` + `pnpm test:e2e`.
- Health: `curl localhost:3001/api/health`. Base importada do Prospex; CLAUDE.md original em `docs/PROSPEX_CLAUDE.md`.

## Convenções
- TypeScript estrito. Validar entradas com zod/class-validator. Erros explícitos, sem `catch` vazio.
- Testes: Vitest/Jest para unidades (classificador de site e score OBRIGATÓRIOS), Playwright já existe para e2e.
- Commits pequenos, Conventional Commits. Uma fase = uma branch `phase/N-nome`.

## Ordem de trabalho
Seguir `BUILD_PLAN.md` fase a fase.
