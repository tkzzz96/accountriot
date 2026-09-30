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
port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

stop_pid() { if [ -f "$RUN/$1.pid" ]; then kill "$(cat "$RUN/$1.pid")" 2>/dev/null || true; rm -f "$RUN/$1.pid"; fi; return 0; }

case "${1:-start}" in
  stop)   stop_pid api; stop_pid web; say "stopped"; exit 0 ;;
  status)
    up "http://localhost:$API_PORT/api/health" && echo "API  up   http://localhost:$API_PORT/api" || echo "API  down"
    up "http://localhost:$WEB_PORT/login"      && echo "WEB  up   http://localhost:$WEB_PORT"     || echo "WEB  down"
    exit 0 ;;
esac
REBUILD=0; [ "${1:-}" = "--rebuild" ] && REBUILD=1

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
set -a; . apps/api/.env; set +a

# 2) Postgres + Redis
need_services=0
port_open 5432 || need_services=1
port_open 6379 || need_services=1
if [ $need_services = 1 ]; then
  if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
    say "subindo Postgres + Redis via Docker"
    POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-prospex}" REDIS_PASSWORD=unused JWT_SECRET=x ENCRYPTION_KEY=x \
      docker compose -f infra/docker-compose.local.yml up -d
  else
    port_open 5432 || { command -v service >/dev/null && service postgresql start >/dev/null 2>&1 || true; }
    port_open 6379 || { command -v redis-server >/dev/null && redis-server --daemonize yes --dir "$RUN" >/dev/null 2>&1 || true; }
  fi
  for i in $(seq 1 30); do port_open 5432 && port_open 6379 && break; sleep 1; done
  port_open 5432 || die "Postgres não está em localhost:5432. Instale Docker (recomendado) ou Postgres 16."
  port_open 6379 || die "Redis não está em localhost:6379. Instale Docker (recomendado) ou Redis 7."
fi

# 3) dependencies, database, build
[ -d node_modules ] || { say "pnpm install"; pnpm install --frozen-lockfile >/dev/null 2>&1 || pnpm install; }
say "prisma generate + migrate"
pnpm --filter @prospex/database exec prisma generate >/dev/null
if ! pnpm --filter @prospex/database db:deploy >/tmp/prospector-migrate.log 2>&1; then
  # Database created earlier with `db push` (no migration history): sync the schema instead.
  pnpm --filter @prospex/database exec prisma db push --skip-generate >/dev/null 2>&1 \
    || { cat /tmp/prospector-migrate.log; die "falha ao preparar o banco (veja acima)"; }
fi
if [ $REBUILD = 1 ] || [ ! -f apps/api/dist/main.js ] || [ ! -d apps/web/.next ]; then
  say "build (primeira vez leva ~1 min)"
  pnpm --filter @prospex/api build >/dev/null
  pnpm --filter @prospex/web build >/dev/null
fi

# 4) discovery driver: real scraper if gosom is reachable, else demo data
if [ -z "${DISCOVERY_DRIVER:-}" ]; then
  if up "${GOSOM_URL:-http://localhost:8080}/api/docs"; then export DISCOVERY_DRIVER=gosom; else export DISCOVERY_DRIVER=mock; fi
fi
say "modo de descoberta: $DISCOVERY_DRIVER $( [ "$DISCOVERY_DRIVER" = mock ] && echo '(dados de DEMONSTRAÇÃO — para leads reais suba o gosom: docker compose -f infra/docker-compose.gosom.yml up -d)')"

# 5) start API + web
stop_pid api; stop_pid web
(cd apps/api && PORT=$API_PORT nohup node dist/main.js >"$RUN/api.log" 2>&1 </dev/null & echo $! >"$RUN/api.pid")
for i in $(seq 1 40); do up "http://localhost:$API_PORT/api/health" && break; sleep 1; done
up "http://localhost:$API_PORT/api/health" || { tail -20 "$RUN/api.log"; die "API não subiu (log: .run/api.log)"; }
(cd apps/web && nohup pnpm exec next start -p "$WEB_PORT" >"$RUN/web.log" 2>&1 </dev/null & echo $! >"$RUN/web.pid")
for i in $(seq 1 40); do up "http://localhost:$WEB_PORT/login" && break; sleep 1; done
up "http://localhost:$WEB_PORT/login" || { tail -20 "$RUN/web.log"; die "Web não subiu (log: .run/web.log)"; }

printf '\n\033[1;32m✔ Prospector no ar\033[0m\n   App:  http://localhost:%s   (crie sua conta em /register)\n   API:  http://localhost:%s/api/docs\n   Parar: scripts/start-local.sh stop\n\n' "$WEB_PORT" "$API_PORT"
