# references module

Attaches 3 website design references (link + thumbnail **by URL**) to every lead.

| Provider   | Status | Notes |
|------------|--------|-------|
| `curated`  | default | `curated_references` table, seeded from `seed.ts` on boot. Edit via `POST /references`. |
| `pinterest`| off     | Needs `PINTEREST_ACCESS_TOKEN` (official API). **ToS risk:** Pinterest forbids scraping and re-hosting pins; we only hotlink thumbnails returned by the official API and never download/store images. Not on the critical path. |
| Behance / Dribbble | not implemented | Neither exposes a public search API today (Behance API is closed to new keys; Dribbble API v2 has no search). Scraping their pages is fragile and against their terms. Add a provider implementing `ReferenceProvider` if you obtain API access. |

Rules: never download or store third-party images (only `thumbUrl` strings); cache per `(niche, language)` with TTL (`REFERENCE_TTL_DAYS`, default 30); thumbnails default to the public WordPress mShots service (`REFERENCE_THUMB_TEMPLATE` to change).
