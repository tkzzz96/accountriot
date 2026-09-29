#!/usr/bin/env bash
# Smoke test: register -> create prospector campaign -> start -> wait -> list leads.
# Usage: scripts/smoke.sh [maxResults]   (API on :3001, run API with DISCOVERY_DRIVER=mock for offline)
set -euo pipefail
B=${API:-http://localhost:3001/api}
N=${1:-100}
EMAIL="smoke$RANDOM@test.dev"
TOKEN=$(curl -sf -X POST $B/auth/register -H 'content-type: application/json' \
  -d "{\"name\":\"Smoke\",\"email\":\"$EMAIL\",\"password\":\"Passw0rd!123\",\"workspaceName\":\"Smoke WS\"}" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken') or d.get('access_token') or d.get('token'))")
H=(-H "Authorization: Bearer $TOKEN" -H 'content-type: application/json')
CID=$(curl -sf -X POST $B/campaigns "${H[@]}" -d "{\"name\":\"Smoke $RANDOM\",\"filter\":{\"niche\":\"barbearia\",\"country\":\"Brasil\",\"city\":\"Curitiba\",\"language\":\"pt-BR\",\"channel\":\"whatsapp\",\"requireNoSite\":true,\"maxResults\":$N,\"service\":\"Criação de site\",\"priceAnchor\":\"a partir de R\$ 1.500\",\"deadline\":\"7 dias\",\"sellerName\":\"Ryan\"}}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
curl -sf -X POST $B/scraper/campaigns/$CID/start "${H[@]}" -d '{}' >/dev/null
for i in $(seq 1 90); do
  S=$(curl -sf $B/campaigns/$CID "${H[@]}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'], d['progress'], d.get('error') or '')")
  echo "[$i] $S"; case "$S" in completed*|failed*) break;; esac; sleep 2
done
curl -sf "$B/leads?campaignId=$CID&limit=200" "${H[@]}" > /tmp/smoke_leads.json
python3 - <<'PY'
import json,collections
d=json.load(open('/tmp/smoke_leads.json'))
print("total", d['total'])
print(collections.Counter(l['siteStatus'] for l in d['data']))
print(collections.Counter(l['pipelineStage'] for l in d['data']))
PY
echo "campaign=$CID token=$TOKEN" > /tmp/smoke_ctx.txt
