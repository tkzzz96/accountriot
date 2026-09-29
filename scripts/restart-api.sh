#!/usr/bin/env bash
# Rebuild-free restart of the built API using a pidfile (DISCOVERY_DRIVER defaults to mock).
cd "$(dirname "$0")/../apps/api"
[ -f /tmp/api.pid ] && kill "$(cat /tmp/api.pid)" 2>/dev/null; sleep 1
DISCOVERY_DRIVER=${DISCOVERY_DRIVER:-mock} nohup node dist/main >/tmp/api.log 2>&1 &
echo $! > /tmp/api.pid
for i in $(seq 1 30); do curl -sf localhost:3001/api/health >/dev/null && { echo "api up"; exit 0; }; sleep 1; done
echo "api failed"; tail -20 /tmp/api.log; exit 1
