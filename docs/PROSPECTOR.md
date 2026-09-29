# Prospector — guia de uso

Ferramenta que, dado um filtro (nicho, cidade/país, porte, orçamento alvo, idioma, canal), encontra empresas **sem site** (ou só com rede social, site gratuito ou domínio morto), enriquece o contato, pontua, escreve um **rascunho** de follow-up, anexa **3 referências de site** do nicho e grava tudo no CRM. **Nada é enviado automaticamente.**

## Subir localmente (com Docker)
```bash
cp .env.example apps/api/.env && cp .env.example packages/database/.env   # ajuste JWT_SECRET e ENCRYPTION_KEY
docker compose up -d postgres redis                                     # Postgres 16 + Redis 7
docker compose -f infra/docker-compose.gosom.yml up -d                  # sidecar gosom em :8080
pnpm install && pnpm --filter @prospex/database db:deploy
pnpm dev                                                                # api :3001, web :3000
```
Sem Docker: Postgres 16 e Redis nativos + `DISCOVERY_DRIVER=mock` para dados fictícios determinísticos.

## Rodar uma campanha
1. Web → **Campanhas → Nova**: nicho, cidade, país, raio, porte, orçamento, idioma, canal, "somente empresas sem site", seu serviço/preço-âncora/prazo.
2. O pipeline (fila BullMQ, um job por lead, com retry/backoff): `discover → classificar site → enriquecer → score → rascunho → referências → READY`.
3. Abra o lead: evidência de por que não tem site, contatos **com origem**, score com breakdown, estimativa de orçamento (*provável / incerto / improvável*), rascunho (Copiar / Abrir no WhatsApp / Abrir e-mail) e 3 referências.
4. Mova no kanban existente (New → Contacted → Replied → Won/Lost). Exporte CSV/JSON (inclui os campos novos).

## Drivers de descoberta (`DISCOVERY_DRIVER`)
| valor | uso |
|---|---|
| `gosom` (padrão) | sidecar Docker `gosom/google-maps-scraper` via REST (`GOSOM_URL`). **Scraping do Maps viola os termos do Google.** |
| `places` | API oficial Places (New), exige `PLACES_API_KEY`. Recomendado para uso comercial. |
| `playwright` | scraper embutido herdado do Prospex (último recurso). |
| `mock` | dados fictícios para testes/demonstração. |

## Regras do produto
- Follow-up é sempre `status: "draft"`; existe teste que falha se qualquer código de envio (SMTP/Twilio/etc.) for adicionado.
- Nenhum dado inventado: todo contato tem `contactSource`; `OWNER` nunca é inferido (só `BUSINESS`/`UNKNOWN`).
- "Capital de US$500" não é público: `budgetScore` é estimativa por sinais, exibida como *provável/incerto/improvável*.
- Classificação "sem site" é determinística (regras + DNS/HTTP); `UNKNOWN` quando ambíguo. Sempre grava `siteEvidence`.
- Crawl de sites de leads respeita `robots.txt` e rate limit (1 req/s/host). Verificação SMTP de e-mail é opcional (`EMAIL_SMTP_VERIFY=true`, exige porta 25).
- LGPD/GDPR: só dados publicamente disponíveis; `DELETE /api/leads/:id` apaga o lead; sem envio em massa.
- Imagens de terceiros nunca são baixadas: só link + miniatura por URL (cache por nicho/idioma).

## Referências de site
Provedor padrão = tabela curada (`GET/POST /api/references`); o seed inicial é **ponto de partida** — troque pelas suas referências favoritas. Pinterest só com API oficial (flag). Behance/Dribbble não têm API pública de busca (ver `apps/api/src/references/README.md`).

## MCP (opcional)
`pnpm --filter @prospex/mcp build` e registre `node apps/mcp/dist/index.js` no seu cliente MCP com `PROSPECTOR_EMAIL`, `PROSPECTOR_PASSWORD`, `PROSPECTOR_API_URL`. Ferramentas: `create_campaign`, `list_leads`, `get_lead`, `regenerate_draft`.

## Testes
`pnpm test` (Vitest: classificador, score, contatos, robots, rascunhos, referências, segurança "sem envio") · `pnpm test:e2e` (Playwright, exige API com `DISCOVERY_DRIVER=mock` e `THROTTLE_LIMIT` alto) · `scripts/smoke.sh 100`.
