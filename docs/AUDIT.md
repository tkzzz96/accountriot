# Auditoria completa — checklist e plano de implementação

Escopo: todo o repositório (API NestJS, web Next.js, banco/Prisma, pipeline, scripts, CI, Docker, docs).
Método: auditoria manual + **7 rodadas** de revisão independente (`code-review`, nível *high*) sobre cada conjunto de correções,
cada rodada validada com testes unitários, lint, build, e2e (Playwright) e verificação de migrações num banco limpo.

Legenda: ✅ feito e verificado · 🟡 parcial / decisão registrada · ⬜ pendente (precisa de decisão, ambiente ou dependência externa)

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
- [ ] ⬜ Token JWT em `localStorage` (exposto a XSS) → cookie `httpOnly` + CSRF (muda API e web).
- [ ] ⬜ TTL de 30 dias sem refresh token → TTL curto + refresh.
- [ ] ⬜ CSP estrita (tiles de mapa e miniaturas são de terceiros; exige allowlist).
- [ ] ⬜ API keys (`px_…`) existem mas não autenticam a REST → usar no MCP no lugar de e-mail/senha.

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
- [ ] ⬜ Verificação SMTP de e-mail, caminho LLM de rascunhos, gosom real e Places API **nunca foram executados contra serviços reais** (sem rede/chave neste ambiente).

### C. Backend / estrutura / banco
- [x] ✅ Índices Postgres nos acessos reais (campanha+etapa, workspace+site/score/crm, atividades, follow-ups).
- [x] ✅ Lista de leads sem JSON pesados nem `activities` (menos payload; detalhe continua completo).
- [x] ✅ Filtros novos na API: `siteStatus`, `stage` (lista), `minScore`; endpoint `POST /leads/:id/retry`; `DELETE /leads/:id` (LGPD).
- [x] ✅ Validação de configuração (Joi) para as variáveis novas.
- [x] ✅ Constantes/tipos compartilhados (sem import circular serviço↔processador).
- [x] ✅ Migrações: nunca reescrever uma migração já commitada (a corretiva é idempotente); verificado `migrate deploy` num banco vazio == schema.
- [ ] ⬜ Teste de integração do pipeline com Postgres/Redis no CI (hoje coberto por e2e + smoke).
- [ ] ⬜ Limpeza de referências por workspace ao excluir workspace (não existe exclusão de workspace ainda).
- [ ] ⬜ Observabilidade: logs estruturados, métricas, orçamento/limite de custo do LLM por workspace.

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
- [ ] ⬜ i18n completo (Dashboard, Analytics, Integrations, Settings seguem em inglês) → adotar biblioteca de i18n.
- [ ] ⬜ Kanban de CRM dedicado e ações em lote.

### E. Infra / CI / docs / testes
- [x] ✅ CI: `pnpm lint`, typecheck do MCP, testes unitários da API **e do MCP**, driver `mock` no e2e.
- [x] ✅ Compose de produção com o gosom isolado + variáveis de descoberta; YAML validado.
- [x] ✅ `.gitignore` (resultados do Playwright, relatórios, dump do Redis, `.run/`); `.env.example` completo.
- [x] ✅ Testes: de 111 → **298 unitários** + 4 do MCP + **29 e2e** (todos passando); suíte de segurança "nenhum código envia mensagens".
- [ ] ⬜ Imagens Docker (api/web) e o fluxo 100% Docker **não foram testados** (sem daemon aqui); aplicar migrações automaticamente no start do container.
- [ ] ⬜ Launcher no **Windows/macOS** só validado em Linux.
- [ ] ⬜ Dependabot/Renovate e `pnpm audit` no CI.

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
| **P3 – Front-end** | D: debounce, filtros, totais, falhas/retry, erros de rede, polling, i18n do fluxo, a11y | ✅ concluída | e2e (29) + tsc + lint |
| **P4 – Infra/CI/docs** | E: CI, compose, gitignore, docs, testes | ✅ concluída (exceto Docker real) | YAML válido, CI atualizado |
| **P5 – Endurecimento (próximo)** | A: cookie `httpOnly`+CSRF, refresh token, API keys no MCP, CSP · C: integração com DB no CI, observabilidade/limites de custo, limpeza por workspace · D: i18n completo, kanban | ⬜ backlog | decisão de produto + 1–2 dias de trabalho |
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
