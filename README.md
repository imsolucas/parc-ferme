# PARC FERMÉ

A retro-arcade F1 pick'em league. Call pole, the podium, fastest lap, the first DNF and one chaos
event before qualifying; scores land on a HIGH SCORE table after the chequered flag.

Runs entirely on Cloudflare's free tier: one Worker (Hono) serves the API, the cron jobs, the share
cards and the built PWA; D1 is the only datastore. Race data comes from the public
[OpenF1 API](https://openf1.org).

```
apps/web        React + Vite + TypeScript + Tailwind PWA
apps/worker     Cloudflare Worker: API, cron, web push, share cards, D1 migrations, tests
packages/shared Types, scoring constants and labels used by both
```

## Quick start (local)

Needs Node 22+ and pnpm 10.

```bash
pnpm install
pnpm vapid                      # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # paste the two keys in
pnpm db:migrate:local           # create the local D1 schema
pnpm seed                       # fake league + one scored round + one open round
pnpm dev                        # web on :5173 (proxies to the worker on :8787)
```

`pnpm seed` prints login links for four seed players, for example
`http://localhost:5173/login#seed-ace`. The seeded past round is the real 2026 Las Vegas Grand Prix
(from the test fixtures); the open round is a fake one that locks two days after you seed.

Useful while developing:

```bash
pnpm test         # vitest: scoring, result derivation, push encryption, calendar sync
pnpm typecheck
# fire the cron handlers by hand (wrangler dev runs with --test-scheduled)
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"   # sync + score
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=*/5+*+*+*+*"    # reminders + push
# admin endpoints (ADMIN_TOKEN from .dev.vars)
curl -X POST localhost:8787/api/admin/sync        -H 'x-admin-token: dev-admin'
curl -X POST localhost:8787/api/admin/score/1300  -H 'x-admin-token: dev-admin'
```

Web push needs a service worker, which only exists in the production build. To try it locally,
open the worker directly at `http://localhost:8787` (it serves `apps/web/dist`) instead of the Vite
dev server.

## Deploy

```bash
npx wrangler login
npx wrangler d1 create parc-ferme          # copy database_id into apps/worker/wrangler.toml
pnpm db:migrate:remote
pnpm vapid                                 # generate production keys
cd apps/worker
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put ADMIN_TOKEN        # any long random string
cd ../..
pnpm run deploy                            # builds the PWA, then `wrangler deploy`
```

Also set `VAPID_SUBJECT` in `wrangler.toml` to a `mailto:` address you read; push services use it to
contact you. The first `*/15` cron tick syncs the calendar and drivers, or trigger it straight away
with `POST /api/admin/sync`.

## How it works

### Rounds and the lock
A round is a Grand Prix weekend that has both a `Qualifying` and a `Race` session (testing and
cancelled meetings are skipped, and sprint qualifying is ignored). `lock_at` is the qualifying start
in UTC; the UI shows the countdown in the viewer's own time zone.

The lock is enforced in the write itself: picks are saved with
`INSERT ... SELECT ... FROM rounds WHERE lock_at > <server now> ON CONFLICT DO UPDATE`, so a late
request changes nothing and gets `423 Locked`. Until a round locks, the API, the share card and the
share page only ever reveal your own picks.

### Scoring

| Pick | Points |
| --- | --- |
| Podium driver in the exact position | 5 |
| Podium driver in the wrong position | 2 |
| Pole | 3 |
| Fastest lap | 2 |
| First DNF | 3 |
| Chaos call | 4 |

Maximum 27 per round. Rules the code applies (see `apps/worker/src/scoring`):

- **Pending is not zero.** A category with no result yet is stored as `NULL` and shown as `--`.
  Pole is scored as soon as qualifying is classified; race categories wait for the chequered flag.
- **Podium**: P1, P2 and P3 must be three different drivers. Disqualified drivers are excluded.
- **Fastest lap**: lowest lap time of the race. Identical times all count.
- **First DNF**: the retired driver with the fewest completed laps. Equal lap counts all count
  (OpenF1 does not give a finer order). A driver who did not start is not a DNF, nor is a DSQ.
  If nobody retires, the category scores 0 for everyone.
- **Chaos calls**, judged from race control messages after lights out (the recorded start of
  lap 1, or the scheduled start if OpenF1 has no timestamp for it):
  - `SAFETY_CAR`: a full safety car was deployed.
  - `VSC`: a virtual safety car was deployed.
  - `RED_FLAG`: a red flag was shown.
  - `LAP1_INCIDENT`: on lap 1 there was an SC, VSC, red flag or a steward "INCIDENT" note, or a
    driver retired without completing a lap.
  - `NO_SC`: neither a safety car nor a VSC was deployed (a red flag alone does not break it).
- **Idempotent and amendable.** Scores are recomputed from scratch and upserted on
  `(pick_id, category)`. Each round stores a hash of its results; after a round is fully scored it is
  re-checked hourly for four days, and a changed hash (a post-race penalty, say) re-scores everyone.
  `POST /api/admin/score/:roundId` forces a re-score at any time.

### Cron
| Trigger | Does |
| --- | --- |
| `*/15 * * * *` | Sync calendar and drivers (cached 6h), fetch results for finished sessions, score |
| `*/5 * * * *` | Queue T-60 and T-10 lock reminders, deliver pending pushes including "results in" |

A 15-minute tick cannot land on T-10, hence the second trigger. Each notification is a row in
`notification_jobs` keyed by `(round, kind)`, so it is sent once; fan-out is paged at 30 pushes per
tick to stay inside the free plan's 50-subrequest limit. Subscriptions that return `410`/`404` are
deleted.

### Web push
`apps/worker/src/push/webpush.ts` implements VAPID (ES256 JWT) and `aes128gcm` payload encryption on
WebCrypto, because the `web-push` npm package depends on Node APIs that Workers do not have. The
encryption is tested against the RFC 8291 example vector.

### Share card
`GET /card/:leagueId/:userId/:roundId` returns a 1200x630 PNG rendered with `workers-og`.
`GET /share/:leagueId/:userId/:roundId` is a server-rendered page carrying the `og:image` tags
(scrapers do not run JavaScript). Rendered cards are cached in D1 per results version.

### Auth
Device-bound session tokens: creating or joining a league mints a random token, the server stores
only its SHA-256, and the browser keeps it in `localStorage`. `/login#<token>` adopts a token on
another device. There is no email login yet.

### OpenF1 politeness
All reads go through `apps/worker/src/openf1/client.ts`: responses are cached in the `api_cache`
table, requests are spaced 400 ms apart, and a normal tick makes zero requests. Result fetches only
happen after a session should have finished.

## Free-tier notes

- Worker bundle is about 740 KB gzipped (limit 3 MB), mostly the `workers-og` WASM.
- Rendering a share card is CPU-heavy next to the free plan's small per-request CPU allowance. Cards are cached, but the
  first render of each card may be rejected under load on the free plan. If you see `1102` errors on
  `/card`, that is why; the rest of the app is unaffected.
- D1 free limits are far above what a few leagues use. Scoring writes one statement per 1,000 picks.

## Restyling

Visual decisions live in three places, so screens can be redesigned without touching data code:

- `apps/web/src/styles/index.css`: colour, font and animation tokens (`@theme`), CRT overlay.
- `apps/web/src/components/ui`: generic primitives (`ArcadeButton`, `Panel`, `Field`, `Blink`, ...).
- `apps/web/src/components/game`: domain components (`PickForm`, `HighScoreTable`, `PicksTable`,
  `Countdown`, ...), all driven by props.

Screens in `apps/web/src/screens` only load data and arrange components. The share card layout is
`apps/worker/src/card/template.ts`. A ready-made brief for Claude Design is in
`docs/claude-design-prompt.md`.
