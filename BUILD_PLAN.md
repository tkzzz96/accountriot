# BUILD_PLAN.md — plano de execução para o Claude Code

Premissas padrão (Ryan pode mudar; tudo é configurável por campanha): CRM = pipeline nativo do Prospex; canal principal = WhatsApp (e-mail como secundário); descoberta = gosom no piloto, com Places API como driver opcional; mensagens em pt-BR ou en, escolhido por campanha; nicho/país do piloto definidos na Fase 0.

## Arquitetura

```
apps/web (Next)  ──►  apps/api (NestJS) ──► Postgres (Prisma) + Redis (BullMQ)
                            │
   pipeline por lead (jobs encadeados na fila):
   discover ─► classifySite ─► enrich ─► score ─► ai(analysis+draft) ─► references ─► ready
        │
        ├─ DiscoveryDriver: GosomDriver | PlacesApiDriver   (interface única)
        ├─ ReferenceProvider: BehanceProvider | DribbbleProvider | CuratedProvider | PinterestProvider(opcional)
        └─ LLM: OpenRouter | Ollama (já suportado pelo Prospex)
```

## Estrutura de pastas alvo (dentro do fork do Prospex)

```
apps/api/src/
  discovery/    discovery.module.ts, discovery.service.ts, drivers/{gosom.driver.ts,places.driver.ts}, dto/
  site-check/   site-classifier.service.ts, rules/{social-domains.ts,free-builders.ts}, http-probe.ts  (+ *.spec.ts)
  enrichment/   enrichment.service.ts, contact-extractor.ts, email-verifier.ts
  scoring/      scoring.service.ts, weights.ts (presets), budget-signals.ts  (+ *.spec.ts)
  references/   references.service.ts, providers/, cache.service.ts
  outreach/     outreach.service.ts (drafts), prompts/{whatsapp.pt-BR.md,email.en.md,...}
  pipeline/     pipeline.processor.ts (orquestra as etapas)
packages/database/prisma/schema.prisma   (migração da Fase 1)
infra/          docker-compose.gosom.yml
vendor-ref/     (git-ignored) repos clonados para consulta
THIRD_PARTY_NOTICES.md
```

## Migração do schema (Fase 1)

Adicionar ao `Lead` (o restante já existe):
- `siteStatus` enum `NONE | SOCIAL_ONLY | FREE_BUILDER | DEAD | HAS_SITE | UNKNOWN`
- `siteEvidence Json?` — `{ url, httpStatus, dnsOk, reason }`
- `whatsapp String?`, `contactSource String?`, `ownerContactType` enum `OWNER | BUSINESS | UNKNOWN` (default UNKNOWN)
- `budgetScore Int @default(0)`, `budgetSignals Json?`
- `references Json?` — array de 3 `{ url, thumbUrl, source, niche, title }`
- `pipelineStage` enum `DISCOVERED | CLASSIFIED | ENRICHED | SCORED | DRAFTED | READY | FAILED`
- `Campaign.filter Json` — `{ niche, country, city, radiusKm, sizeHint, budgetUsd, language, channel, requireNoSite }`
- Índice único para dedupe: `(workspaceId, phoneNormalized)`; campo `dedupeKey String`.

## Fases (cada uma com critério de aceite)

### Fase 0 — Setup e reconhecimento (meio dia)
- Fork do Prospex, `pnpm install`, subir Docker (Postgres/Redis), rodar app e testes existentes.
- Criar `infra/docker-compose.gosom.yml` e provar uma chamada REST ao gosom retornando lugares.
- Copiar CLAUDE.md e este plano para a raiz. Clonar refs em `vendor-ref/`.
- **Aceite:** app sobe localmente; gosom retorna ≥10 lugares para uma busca de teste; documentar os comandos reais no CLAUDE.md.

### Fase 1 — Filtro, descoberta e classificador "sem site"
- Migração do schema acima.
- `DiscoveryDriver` (interface) + `GosomDriver` (usar `-geo`, `-radius`, `-grid-bbox`, JSON). `PlacesApiDriver` como stub atrás de flag (`PLACES_API_KEY`).
- Formulário de campanha no web com os campos de `Campaign.filter`.
- `SiteClassifier`: regras em ordem — website vazio → `NONE`; domínio em `social-domains.ts` (instagram, facebook, linktr.ee, wa.me, tiktok, etc.) → `SOCIAL_ONLY`; domínio em `free-builders.ts` (wixsite, business.site, weebly, blogspot, carrd, etc.) → `FREE_BUILDER`; DNS/HTTP falha (timeout, 4xx/5xx persistente, parked domain) → `DEAD`; caso contrário `HAS_SITE`. Ambíguo → `UNKNOWN` (fila para IA).
- Dedupe por telefone normalizado + nome/endereço normalizado.
- **Aceite:** testes unitários com ≥30 casos de URL cobrindo cada categoria; campanha piloto de 100 lugares grava leads com `siteStatus` e `siteEvidence`; `requireNoSite` filtra corretamente.

### Fase 2 — Enriquecimento e score
- `enrichment`: telefone/WhatsApp (normalizar E.164), redes sociais; se houver site/rede, extrair e-mails/telefones (portar ideia do omkarcloud) respeitando robots.txt e rate limit. Verificação MX (+ SMTP opcional por flag, só com porta 25 liberada).
- `scoring`: portar `agency_opportunity` do LeadForge para TS (`weights.ts`, pesos por campanha). Fatores: sem site (peso alto), telefone/WhatsApp, nota e nº de avaliações, perfil do Google não reivindicado (se disponível), presença social ativa.
- `budget-signals.ts`: proxies de capacidade de pagar (faixa de preço do Maps, avaliações, nº de fotos, tempo de atividade, anúncios se detectáveis) → `budgetScore` + texto "provável/incerto".
- Prioridade HOT/WARM/COLD a partir do score.
- **Aceite:** testes de score com fixtures (lead ideal vs. lead ruim); cada peso é explicável (`aiAnalysis.breakdown` lista contribuições); nenhum campo de contato sem `contactSource`.

### Fase 3 — IA: análise e follow-up em rascunho
- `outreach.service`: prompts por canal × idioma em `prompts/*.md` (versionados). Entrada: dados reais do lead (nome, categoria, nota, avaliações, `siteStatus`, evidência) + perfil de oferta do Ryan (serviço, preço-âncora, prazo) vindo de config.
- Saída em `marketingContent`: `{ channel, lang, text, subject?, status: "draft", generatedAt }`. Curto no WhatsApp, sem promessas falsas, cita um fato real do lead, termina com pergunta simples.
- UI: no card do lead, botões "Copiar" e "Abrir no WhatsApp" (`wa.me` com texto) / "Abrir e-mail" (mailto). Nada é enviado pelo sistema.
- **Aceite:** teste que garante que nenhum caminho de código envia mensagem; snapshot de 5 rascunhos revisados pelo Ryan.

### Fase 4 — Referências de site (3 por lead)
- `ReferenceProvider` interface; começar por `CuratedProvider` (tabela própria de referências por nicho, seed de ~10 por nicho) + `Behance/Dribbble` por busca de nicho. `PinterestProvider` só atrás de flag e só se houver forma permitida (API oficial); documentar o risco de ToS no README do módulo.
- Cache por `(niche, language)` com TTL; escolher 3 diversas por lead. Guardar link + miniatura por URL, sem baixar arquivos.
- **Aceite:** cada lead READY tem 3 referências; segunda campanha do mesmo nicho não refaz busca (cache hit em log).

### Fase 5 — Pipeline ponta a ponta e CRM
- `pipeline.processor`: encadeia as etapas via BullMQ com retry/backoff, `pipelineStage` visível na UI, erros vão para `FAILED` com motivo.
- Card do lead no CRM mostra: status do site + evidência, contato (com origem), score + `budgetScore`, rascunho de mensagem, 3 referências (miniaturas clicáveis). Kanban existente do Prospex (New → Contacted → Replied → Won/Lost).
- Exportar CSV (já existe) incluindo os novos campos.
- **Aceite:** e2e Playwright: criar campanha → leads chegam a READY → abrir card → ver referências e rascunho. Rodada real: 1 cidade × 1 nicho.

### Fase 6 (opcional) — MCP server e Twenty
- MCP com ferramentas `create_campaign`, `list_leads`, `get_lead`, `regenerate_draft` (modelo: `mcp_server.py` do LeadForge).
- Sync opcional com Twenty via API/webhook (verificar licença/API antes).

## Definição de pronto (MVP)
Uma campanha real "nicho X em cidade Y" gera ≥50 leads sem site, cada um com: evidência de por que não tem site, contato com origem marcada, score, rascunho de follow-up, 3 referências — tudo visível no card do CRM. Zero envio automático.

## Riscos que o Claude Code deve respeitar
- Scraping do Google Maps viola os termos do Google: manter o driver do Places API pronto e configurável.
- LGPD/GDPR/CAN-SPAM: guardar só dados publicamente disponíveis, permitir apagar lead, sem envio em massa.
- Pinterest: fora do caminho crítico.
- Locus (AGPL) e repos sem licença: só ideias.

## Prompt inicial sugerido para colar no Claude Code
> Leia CLAUDE.md e BUILD_PLAN.md. Execute a Fase 0 e pare para eu aprovar. Antes de codar, me mostre em bullets o que vai fazer e quais comandos reais do repositório você confirmou.
