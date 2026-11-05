# Auditoria completa — checklist e plano de implementação

Escopo: todo o repositório (API NestJS, web Next.js, banco/Prisma, pipeline, scripts, CI, Docker, docs).
Método: auditoria manual + **7 rodadas** de revisão independente (`code-review`, nível *high*) sobre cada conjunto de correções,
cada rodada validada com testes unitários, lint, build, e2e (Playwright) e verificação de migrações num banco limpo.

Legenda: ✅ feito e verificado · 🟡 parcial / decisão registrada · ⬜ pendente (precisa de decisão, ambiente ou dependência externa) · `[~]` = parcialmente feito

---

## 1. Checklist

### A. Segurança
- [x] ✅ **SSRF no crawler/probe**: URLs vêm de dados de terceiros (campo `website`). Novo cliente `safeGet`: só http/https, portas web, **só IPs públicos** (IPv4/IPv6, mapeados, NAT64, 6to4), verificação dentro do `lookup` do socket (sem DNS-rebinding), cada redirect revalidado, limites de redirects/bytes/prazo total. 60+ testes.
- [x] ✅ **Isolamento entre tenants**: o `WorkspaceId` caía num workspace compartilhado (`default-workspace`) → agora 401. Login sem workspace → 403.
- [x] ✅ **Revogação de acesso**: JWT de 30 dias continuava valendo após remover o membro → o guard confere a associação a cada requisição.
- [x] ✅ **Escalada de privilégio**: corpo de convite/papel sem DTO aceitava `role: "owner"` ou qualquer texto → DTOs com lista fechada (`admin|member`); só o owner altera/remove admins.
- [x] ✅ **Referências curadas**: lista era global e editável por qualquer usuário → agora por workspace; seed global somente leitura; só owner/admin editam; URLs só http(s).
- [x] ✅ **Injeção de fórmula em CSV** (nomes/endereços de terceiros): células iniciadas por `= + - @` são neutralizadas.
- [x] ✅ **Prompt injection**: campos de terceiros saneados (sem quebras/controles/colchetes, tamanho limitado), prompt de sistema declara os dados como não confiáveis, saída continua validada.
- [x] ✅ **Validação de entrada**: DTOs com limites (`MaxLength`, faixas de lat/lng, orçamento…), paginação à prova de NaN, filtros com whitelist.
- [x] ✅ **Rate limit** em endpoints caros (`/draft` 10/min, `/start` 6/min).
- [x] ✅ **Swagger** desligado em produção (`ENABLE_API_DOCS`).
- [x] ✅ **Links no front**: `href`/`src` só http(s) (`safeHref`).
- [x] ✅ **Headers de segurança no web** (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).
- [x] ✅ **CORS** aceita loopback em qualquer porta (corrige "Failed to fetch") sem abrir para origens externas.
- [x] ✅ **Launcher não executa o `.env`** (antes `source`): parser seguro (aspas, comentários, escapes estilo dotenv).
- [x] ✅ **Sessão em cookie `httpOnly`** (`prospector_session`) + CSRF *double-submit* (`prospector_csrf` / `x-csrf-token`, exigido só em chamadas com cookie e método não seguro); nada de token em `localStorage`; filiação ao workspace revalidada a cada requisição; CORS com credenciais só para origens permitidas. Testes unitários (guard, sessão) + e2e (cookie httpOnly, CSRF 403/201).
- [x] ✅ **TTL curto com renovação deslizante**: `JWT_EXPIRES_IN` (padrão 7d); o guard reemite o cookie quando ele tem mais de 1 dia. (Em vez de um refresh token separado: menos superfície, mesmo efeito para sessão de navegador.)
- [x] ✅ **CSP** no web: `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` só o próprio site + a API; `img-src https:` (tiles OSM e miniaturas são de terceiros por desenho e nunca são armazenados); `script-src` exige `'unsafe-inline'` por causa do bootstrap do Next (nonce forçaria renderização dinâmica de todas as páginas). Coberto por e2e.
- [x] ✅ **API keys (`Authorization: ApiKey px_…`) autenticam a REST**, escopo = workspace, sem identidade de usuário (endpoints só-de-usuário respondem 403); o MCP usa `PROSPECTOR_API_KEY` (e-mail/senha continua como alternativa). Criar/excluir chaves e mexer em integrações exige owner/admin.

### B. Bugs de lógica / corretude
- [x] ✅ **Fabricação de leads falsos**: o caminho legado do Prospex inventava leads quando o scraping falhava (violava "nenhum dado inventado") → caminho legado removido (código, módulo `ai/`, colunas derivadas do filtro).
- [x] ✅ **Retry/reinício deixava leads parados** em `CLASSIFIED` → o job de campanha enfileira todos os leads não terminados.
- [x] ✅ **Corrida na deduplicação** (`P2002`) tratada; jobs por lead com `jobId` determinístico (sem processamento duplo).
- [x] ✅ **Início duplo de campanha** (409) e **campanha presa em "running"** se a fila falhar; janela de reinício após 30 min.
- [x] ✅ `startedAt` era sobrescrito a cada tick de progresso.
- [x] ✅ **Ordenação por prioridade** estava errada (`HIGH, LOW, MEDIUM`) → ordena por score.
- [x] ✅ **País desconhecido assumia +55** → nunca adivinha; tabela de países ampliada, busca sem acento/caixa (pt/en/es).
- [x] ✅ **Falso "sem site"**: erro transitório de DNS virava DEAD → só NXDOMAIN-style e com conectividade confirmada; host em IP privado → UNKNOWN (nunca acessado); sem rede → UNKNOWN.
- [x] ✅ **Respostas truncadas** não são mais tratadas como completas (robots.txt estrito; sondagem/páginas aceitam parcial sinalizado); prazo total rígido (anti slow-drip); tamanho máximo real.
- [x] ✅ **Rate limit do crawler** furado por concorrência → fila serializada por host; caches limitados.
- [x] ✅ Jobs do gosom nunca eram apagados; chamadas HTTP sem timeout (gosom/Places/Pinterest).
- [x] ✅ Chromium do scraper legado nunca fechava; sem `enableShutdownHooks` (workers/Redis/Prisma).
- [x] ✅ Seed de referências: sincroniza título/miniatura, invalida só o cache dos nichos afetados, poda opt-in.
- [x] ✅ Retry de página truncada preserva a melhor versão e registra "contatos podem estar incompletos"; para o crawl do host após falha dupla.
- [x] ✅ `contactability` com expressão sem efeito removida.
- [x] ✅ Lançador: processo antigo ocupando a porta era mascarado pelo health check; `stop` deixava `next-server` órfão; `set -e` matava o script sem pidfile.
- [~] 🟡 Verificação SMTP, caminho LLM, gosom e Places agora têm testes contra **servidores falsos** (SMTP que nunca recebe `DATA`, API do gosom, Places com `fetch` simulado, cliente LLM injetável). Falta rodar contra os **serviços reais** (depende de rede/chave — ver F).

### C. Backend / estrutura / banco
- [x] ✅ Índices Postgres nos acessos reais (campanha+etapa, workspace+site/score/crm, atividades, follow-ups).
- [x] ✅ Lista de leads sem JSON pesados nem `activities` (menos payload; detalhe continua completo).
- [x] ✅ Filtros novos na API: `siteStatus`, `stage` (lista), `minScore`; endpoint `POST /leads/:id/retry`; `DELETE /leads/:id` (LGPD).
- [x] ✅ Validação de configuração (Joi) para as variáveis novas.
- [x] ✅ Constantes/tipos compartilhados (sem import circular serviço↔processador).
- [x] ✅ Migrações: nunca reescrever uma migração já commitada (a corretiva é idempotente); verificado `migrate deploy` num banco vazio == schema.
- [x] ✅ Teste de integração do pipeline com **Postgres real** (`pipeline.int.spec.ts`: descoberta→READY, dedupe, retry, ações em lote, isolamento entre workspaces); roda no CI com `RUN_INTEGRATION=1` e é pulado localmente sem banco.
- [x] ✅ `DELETE /workspace` (só o dono, confirmando o *slug* digitado) apaga leads, campanhas, chaves, integrações **e as referências do workspace**; botão real na UI.
- [x] ✅ Observabilidade: log de acesso JSON com `X-Request-Id` (sem corpo/query), `GET /ops/stats` (etapas, situação do site, filas, uso de IA); **limite diário de rascunhos com IA por workspace** (`LLM_DAILY_DRAFT_LIMIT`) — acima dele usa o modelo de texto padrão; chave de IA do workspace agora é de fato usada pelo backend. (Métricas Prometheus ficam fora de escopo: sem consumidor definido.)

### D. Front-end / UX
- [x] ✅ Debounce da busca estava quebrado (um timer por tecla).
- [x] ✅ Botão **Filter** morto → filtros reais (site, score, etapa) na lista e na campanha.
- [x] ✅ Contagem de leads limitada a 50 → total real; limite 200.
- [x] ✅ Falha de campanha/lead visível, com **Tentar novamente**; estado vazio explicado.
- [x] ✅ Erro de rede legível ("Failed to fetch" → mensagem acionável); `204 No Content` não quebra mais.
- [x] ✅ Polling do lead sem piscar o esqueleto; erro de poll não apaga dado carregado.
- [x] ✅ Evidência do site traduzida por código estável (`siteEvidence.code`).
- [x] ✅ Acessibilidade: labels nos filtros, `role="alert"`, `alt` nas referências, `aria-label` nos links.
- [x] ✅ Telas do fluxo do prospector em pt-BR.
- [x] ✅ **i18n completo** (pt-BR padrão + en) com provedor próprio e catálogo tipado (a versão em inglês não compila se faltar chave); troca de idioma no menu do usuário. Textos gerados pelo backend (pesos do score) continuam em pt-BR.
- [x] ✅ **Kanban de CRM** (`/crm`: arrastar e soltar + seletor acessível por teclado, com reversão em caso de erro) e **ações em lote** na lista (mover status / excluir, até 200). Também: filtros e página na URL, paginação, notas do lead, exclusão de lead (LGPD) e exportar ao webhook de CRM (`LEAD_WEBHOOK_URL`, assinado com HMAC; o rascunho segue como rascunho).

### E. Infra / CI / docs / testes
- [x] ✅ CI: `pnpm lint`, typecheck do MCP, testes unitários da API **e do MCP**, driver `mock` no e2e.
- [x] ✅ Compose de produção com o gosom isolado + variáveis de descoberta; YAML validado.
- [x] ✅ `.gitignore` (resultados do Playwright, relatórios, dump do Redis, `.run/`); `.env.example` completo.
- [x] ✅ Testes: de 111 → **342 unitários** (+5 de integração com Postgres) + 6 do MCP + **42 e2e** (2 *skip* de exportação); suíte de segurança "nenhum código envia mensagens".
- [~] 🟡 Container da API aplica `prisma migrate deploy` ao iniciar (`RUN_MIGRATIONS=false` desliga); instalação `--frozen-lockfile` dos estágios `deps` simulada para api e web. **Falta** `docker build`/`compose up` de verdade (sem daemon aqui).
- [~] 🟡 `start.cmd` (Windows → Git Bash) adicionado; launcher segue validado só em Linux — falta testar no Windows/macOS.
- [x] ✅ Dependabot (npm agrupado, Actions, Docker) e `pnpm audit --audit-level=critical` no CI. Dependências atualizadas (Next 16.4.1, Vitest 4, Joi, SDK do MCP…) + `pnpm.overrides` com faixas *caret*: **87 → 7 avisos, 0 críticos/altos**. Restam só 3 *low* + 4 *moderate* em ferramentas de build (`@nestjs/cli`, ESLint) e no `@nestjs/core` 10 (corrigir exige migrar para Nest 11 — fora de escopo, ver backlog).

### F. Produto (fora do que dá para fechar só com código)
- [ ] ⬜ Rodada real 1 cidade × 1 nicho (gosom ou Places) para calibrar pesos de score e filtros.
- [ ] ⬜ Revisão humana do tom dos rascunhos com LLM real; trocar o seed de referências pelas suas favoritas.
- [ ] ⬜ Behance/Dribbble (sem API pública de busca) e sync com Twenty.

---

## 2. Plano de implementação (todos os itens do checklist)

| Fase | Itens | Status | Como foi/será verificado |
|---|---|---|---|
| **P0 – Crítico (segurança/dados)** | A: SSRF, isolamento de tenants, revogação, escalada de privilégio, referências, CSV, prompt injection · B: fabricação de leads | ✅ concluída | testes unitários (SSRF, DTOs, CSV, sanitização) + e2e |
| **P1 – Corretude do pipeline** | B: retry, dedupe, double-start, `startedAt`, ordenação, país, DNS/falso "sem site", truncamento, rate limit, gosom | ✅ concluída | testes unitários + smoke + e2e + `migrate deploy` limpo |
| **P2 – Estrutura e banco** | C: índices, lista leve, filtros/endpoints, Joi, constantes, política de migrações | ✅ concluída | `prisma migrate diff` == schema; build/lint |
| **P3 – Front-end** | D: debounce, filtros, totais, falhas/retry, erros de rede, polling, i18n do fluxo, a11y | ✅ concluída | e2e + tsc + lint |
| **P4 – Infra/CI/docs** | E: CI, compose, gitignore, docs, testes | ✅ concluída (exceto Docker real) | YAML válido, CI atualizado |
| **P5 – Endurecimento** | A: cookie `httpOnly`+CSRF, sessão deslizante, API keys (REST + MCP), CSP · C: integração com DB no CI, observabilidade/limite de custo do LLM, exclusão de workspace · D: i18n completo, kanban, lote · E: Dependabot, audit no CI, migrações no start do container | ✅ concluída | unitários (342) + integração (Postgres) + e2e (42) + `pnpm audit` sem críticos/altos + build/lint |
| **P6 – Validação em ambiente real** | B/E/F: gosom/Places/LLM/SMTP reais, Docker de ponta a ponta, launcher Windows/macOS, rodada real 1 cidade × 1 nicho, calibração de score, revisão do tom | ⬜ depende de você | rodar na sua máquina e me enviar logs/erros |

---

## 3. Registro do loop e critério de parada

| Rodada | Achados | Resultado |
|---|---|---|
| 1 | auditoria manual (backend, front, infra) | ~45 itens corrigidos |
| 2 | revisão independente #1 | 9 achados reais (2 eram regressões minhas) → todos corrigidos |
| 3 | revisão #2 | 10 achados → 9 corrigidos, 1 backlog |
| 4 | revisão #3 | 8 achados → 7 corrigidos, 1 sem mudança (custo mínimo) |
| 5 | revisão #4 | 9 achados → todos tratados (migração idempotente, fallback lazy, seed sync…) |
| 6 | revisão #5 | 10 achados → 9 aplicados + testes puros |
| 7 | revisão #6 | 9 achados → apenas estilo/decisões opostas às da rodada anterior (ex.: `EBADNAME`, parar ou não o crawl) |

**Critério de parada:** as duas últimas rodadas deixaram de apontar defeitos de comportamento e passaram a **alternar entre decisões
de projeto equivalentes** (a rodada 7 contradisse a 6) e a comentar estilo. Registrei as decisões (`EBADNAME` conservador → nunca
gera falso "sem site"; crawl para após falha dupla do host; poda de seed opt-in) e documentei o que fica para o backlog acima.
Continuar o loop agora só geraria churn, não qualidade.

## 4. Decisões de projeto registradas
- **Falso "sem site" é pior que falso "tem site"** → qualquer dúvida (DNS transitório, `EBADNAME`, IP privado, sem rede) vira `UNKNOWN`.
- **Migrações são imutáveis** depois de commitadas; correções entram como novas migrações idempotentes.
- **Referências**: seed global é somente leitura; edições são por workspace; poda do seed é opt-in (`REFERENCE_PRUNE_SEED`).
- **Mensagens**: continuam sendo apenas rascunhos; existe teste que falha se qualquer código de envio for adicionado.
- **Sessão**: cookie `httpOnly` + CSRF *double-submit*; Bearer e `ApiKey` não precisam de CSRF (o navegador nunca os anexa sozinho). API key = escopo de workspace, sem usuário.
- **Overrides do pnpm** sempre com faixa *caret* (`^x.y.z`): uma faixa `>=` pode saltar de major (isso quase trocou `brace-expansion@1` pela 5.x e quebraria o `minimatch@3`).
- **Backlog consciente**: migrar Nest 10 → 11 (fecha o último *moderate* do `@nestjs/core`); Behance/Dribbble (sem API pública de busca) e sync direto com o Twenty (hoje via webhook).
