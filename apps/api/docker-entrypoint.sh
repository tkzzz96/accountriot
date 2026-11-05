#!/bin/sh
# Applies pending Prisma migrations (idempotent, safe with several replicas: Prisma takes an advisory lock) and starts the API.
# Set RUN_MIGRATIONS=false to skip, e.g. when migrations are run by a separate deploy job.
set -e
if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "[entrypoint] applying database migrations…"
  (cd /app && pnpm --filter @prospex/database exec prisma migrate deploy)
fi
exec node dist/main
