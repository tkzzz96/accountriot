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

## Comandos (confirmar em Fase 0 e atualizar aqui)
- `pnpm install` · `pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm test`
- `docker compose up -d` (Postgres, Redis, gosom sidecar)
- `pnpm --filter database prisma migrate dev`

## Convenções
- TypeScript estrito. Validar entradas com zod/class-validator. Erros explícitos, sem `catch` vazio.
- Testes: Vitest/Jest para unidades (classificador de site e score OBRIGATÓRIOS), Playwright já existe para e2e.
- Commits pequenos, Conventional Commits. Uma fase = uma branch `phase/N-nome`.

## Ordem de trabalho
Seguir `BUILD_PLAN.md` fase a fase.
