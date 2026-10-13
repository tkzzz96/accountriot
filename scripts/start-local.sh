#!/usr/bin/env bash
# Prospector — one-command local launcher.
#   scripts/start-local.sh          start everything (builds on first run)
#   scripts/start-local.sh stop     stop API + web
#   scripts/start-local.sh status   show what is running
#   scripts/start-local.sh --rebuild   force a rebuild before starting
# Web: http://localhost:3000   API: http://localhost:3001/api   Docs: http://localhost:3001/api/docs
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RUN="$ROOT/.run"; mkdir -p "$RUN"
API_PORT=${API_PORT:-3001}; WEB_PORT=${WEB_PORT:-3000}

say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
up()  { curl -sf "$1" >/dev/null 2>&1; }
# Bounded probe (2s) so a firewalled/slow port can never hang the launcher.
port_open() { timeout 2 bash -c "exec 3<>/dev/tcp/127.0.0.1/$1" 2>/dev/null; }
IS_WINDOWS=0; case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;; esac

# Kill a launched process together with its children (pnpm -> next-server would otherwise be orphaned).
kill_tree() {
  local pid="$1"
  if [ "$IS_WINDOWS" = 1 ] && command -v taskkill >/dev/null 2>&1; then
    taskkill //PID "$pid" //T //F >/dev/null 2>&1 || true
  else
    local child
    if command -v pgrep >/dev/null 2>&1; then
      for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
    fi
    kill "$pid" 2>/dev/null || true
  fi
}
stop_pid() { if [ -f "$RUN/$1.pid" ]; then kill_tree "$(cat "$RUN/$1.pid")"; rm -f "$RUN/$1.pid"; fi; return 0; }

case "${1:-start}" in
  stop)   stop_pid api; stop_pid web; say "stopped"; exit 0 ;;
  status)
    up "http://localhost:$API_PORT/api/health" && echo "API  up   http://localhost:$API_PORT/api" || echo "API  down"
    up "http://localhost:$WEB_PORT/login"      && echo "WEB  up   http://localhost:$WEB_PORT"     || echo "WEB  down"
    exit 0 ;;
esac
REBUILD=0; [ "${1:-}" = "--rebuild" ] && REBUILD=1

say "verificando Node e pnpm"
command -v node >/dev/null || die "Node.js 20+ é necessário (https://nodejs.org)"
command -v pnpm >/dev/null || { say "instalando pnpm"; npm install -g pnpm@9 >/dev/null; }

# 1) .env with random secrets (never overwritten)
if [ ! -f apps/api/.env ]; then
  say "criando apps/api/.env com segredos aleatórios"
  rnd() { openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64; }
  sed -e "s#yourpassword#prospex#g" \
      -e "s#^JWT_SECRET=.*#JWT_SECRET=$(rnd)#" \
      -e "s#^ENCRYPTION_KEY=.*#ENCRYPTION_KEY=$(rnd)#" .env.example > apps/api/.env
  cp apps/api/.env packages/database/.env
fi
[ -f packages/database/.env ] || cp apps/api/.env packages/database/.env
# Parse KEY=VALUE lines without executing them: `source` would run $(...) or break on '&', '$', spaces.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ''|\#*) continue ;; esac
  key="${line%%=*}"; val="${line#*=}"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  val="${val%\"}"; val="${val#\"}"
  [ -z "${!key+x}" ] && export "$key=$val"   # real environment variables win over the file
done < apps/api/.env

# 2) Postgres + Redis
say "verificando Postgres (5432) e Redis (6379)"
need_services=0
port_open 5432 || need_services=1
port_open 6379 || need_services=1
if [ $need_services = 1 ]; then
  if command -v docker >/dev/null && timeout 20 docker info >/dev/null 2>&1; then
    say "subindo Postgres + Redis via Docker (a primeira vez baixa as imagens, pode levar alguns minutos)"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-prospex}" \
      docker compose -f infra/docker-compose.local.yml up -d || die "docker compose falhou (veja acima)"
  elif [ $IS_WINDOWS = 1 ]; then
    die "Postgres/Redis não encontrados e o Docker não respondeu.
   → Abra o Docker Desktop, espere o ícone ficar verde ('Engine running') e rode 'pnpm app' de novo.
   → Sem Docker: instale Postgres 16 e Redis e deixe-os rodando nas portas 5432 e 6379."
  else
    port_open 5432 || { command -v service >/dev/null && service postgresql start >/dev/null 2>&1 || true; }
    port_open 6379 || { command -v redis-server >/dev/null && redis-server --daemonize yes --dir "$RUN" >/dev/null 2>&1 || true; }
  fi
  say "aguardando Postgres e Redis ficarem prontos"
  for i in $(seq 1 60); do port_open 5432 && port_open 6379 && break; sleep 2; done
  port_open 5432 || die "Postgres não está em localhost:5432. Instale/abra o Docker Desktop (recomendado) ou Postgres 16."
  port_open 6379 || die "Redis não está em localhost:6379. Instale/abra o Docker Desktop (recomendado) ou Redis 7."
fi

# 3) dependencies, database, build
[ -d node_modules ] || { say "pnpm install (primeira vez, pode levar alguns minutos)"; pnpm install --frozen-lockfile || pnpm install; }
say "prisma generate + migrate"
pnpm --filter @prospex/database exec prisma generate >/dev/null
if ! pnpm --filter @prospex/database db:deploy >/tmp/prospector-migrate.log 2>&1; then
  # Database created earlier with `db push` (no migration history): sync the schema instead.
  pnpm --filter @prospex/database exec prisma db push --skip-generate >/dev/null 2>&1 \
    || { cat /tmp/prospector-migrate.log; die "falha ao preparar o banco (veja acima)"; }
fi
if [ $REBUILD = 1 ] || [ ! -f apps/api/dist/main.js ] || [ ! -d apps/web/.next ]; then
  say "build da API e do web (primeira vez leva 1-3 min)"
  pnpm --filter @prospex/api build
  pnpm --filter @prospex/web build
fi

# 4) discovery driver: real scraper if gosom is reachable, else demo data
if [ -z "${DISCOVERY_DRIVER:-}" ]; then
  if up "${GOSOM_URL:-http://localhost:8080}/api/docs"; then export DISCOVERY_DRIVER=gosom; else export DISCOVERY_DRIVER=mock; fi
fi
say "modo de descoberta: $DISCOVERY_DRIVER $( [ "$DISCOVERY_DRIVER" = mock ] && echo '(dados de DEMONSTRAÇÃO — para leads reais suba o gosom: docker compose -f infra/docker-compose.gosom.yml up -d)')"

# 5) start API + web
stop_pid api; stop_pid web
sleep 1
for pair in "API:$API_PORT" "WEB:$WEB_PORT"; do
  if port_open "${pair#*:}"; then
    die "A porta ${pair#*:} (${pair%%:*}) já está em uso por outro processo, provavelmente uma execução antiga.
   → Rode 'pnpm app:stop'; se persistir, feche o processo node antigo (Windows: Gerenciador de Tarefas → node.exe; Linux/Mac: lsof -i :${pair#*:}) ou use outra porta: API_PORT=3101 WEB_PORT=3100 pnpm app"
  fi
done
(cd apps/api && PORT=$API_PORT nohup node dist/main.js >"$RUN/api.log" 2>&1 </dev/null & echo $! >"$RUN/api.pid")
for i in $(seq 1 40); do up "http://localhost:$API_PORT/api/health" && break; kill -0 "$(cat "$RUN/api.pid")" 2>/dev/null || break; sleep 1; done
kill -0 "$(cat "$RUN/api.pid")" 2>/dev/null || { tail -20 "$RUN/api.log"; die "A API encerrou logo após iniciar (log acima, .run/api.log)"; }
up "http://localhost:$API_PORT/api/health" || { tail -20 "$RUN/api.log"; die "API não subiu (log: .run/api.log)"; }
(cd apps/web && nohup node node_modules/next/dist/bin/next start -p "$WEB_PORT" >"$RUN/web.log" 2>&1 </dev/null & echo $! >"$RUN/web.pid")
for i in $(seq 1 40); do up "http://localhost:$WEB_PORT/login" && break; kill -0 "$(cat "$RUN/web.pid")" 2>/dev/null || break; sleep 1; done
kill -0 "$(cat "$RUN/web.pid")" 2>/dev/null || { tail -20 "$RUN/web.log"; die "O web encerrou logo após iniciar (log acima, .run/web.log)"; }
up "http://localhost:$WEB_PORT/login" || { tail -20 "$RUN/web.log"; die "Web não subiu (log: .run/web.log)"; }

printf '\n\033[1;32m✔ Prospector no ar\033[0m\n   App:  http://localhost:%s   (crie sua conta em /register)\n   API:  http://localhost:%s/api/docs\n   Parar: scripts/start-local.sh stop\n\n' "$WEB_PORT" "$API_PORT"
