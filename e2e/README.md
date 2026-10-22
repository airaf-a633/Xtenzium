# End-to-end test harness for the dialer

Docker (and so the real Supabase stack) isn't always available, so this is a faithful stand-in:

| Piece | What it is | How real it is |
|---|---|---|
| Database | [PGlite](https://pglite.dev) (Postgres in memory) running **every** file in `supabase/migrations/` | Real SQL, real row-level security, real functions |
| API | `shim.mjs` — a small PostgREST subset + login endpoints | An imitation. Covers the filters, ordering, counts, single-row, writes and RPC calls the CRM uses |
| App | The real CRM in the browser (`vite --mode e2e`) | Real |

It never touches production: the app is pointed at `http://localhost:54321`.

## Run it

```bash
npm run test:db          # ~40 s. The database rules, as each role (rep, owner, anonymous). Exits non-zero on failure.
```

For the app against the local backend (two terminals):

```bash
cp .env.e2e.example .env.e2e
npm run e2e:api          # the backend on :54321 (fresh database every start; migrations applied)
npm run e2e:web          # the app on :5180
```

Open <http://localhost:5180/crm/login> and sign in as one of the two seeded users (any password):

| User | Role |
|---|---|
| `rep@xtenzium.com` | caller (the sales rep) |
| `owner@xtenzium.com` | admin |

## Test hooks (backend only)

These exist so scenarios can be set up and failures simulated. They are open on localhost; there is no auth on them.

| Endpoint | Does |
|---|---|
| `POST /__sql` `{sql}` | Run SQL, return rows (seed data, inspect state) |
| `GET /__open_zone` | A US time zone whose business hours are open right now (the queue is time-dependent) |
| `GET /__fail?on=1` | Every API call answers 503 (lost connection) |
| `GET /__401?on=1` | API calls answer 401 until the login is refreshed (expired token) |
| `GET /__revoke?on=1` | Refreshing the login fails (revoked session) |
| `GET /__latency?ms=800` | Add delay to API calls |
| `GET /__refreshes` | How many login refreshes were attempted (for refresh-storm checks) |
| `GET /__log` | The last 80 API requests |

## Scenarios

See [scenarios.md](scenarios.md): the rep's day and the owner's follow-ups, with what to expect. Run them before a release that touches the dialer.

## Not covered

Realtime (live feed), the Google/Zoho calendar integrations, native browser dialogs (`confirm`), a real Google Voice call, genuinely flaky networks.
