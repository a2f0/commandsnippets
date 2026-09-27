# Tearleads Backend v2

The Commandsnippets API on Cloudflare Workers: [Hono](https://hono.dev) on
workerd, [D1](https://developers.cloudflare.com/d1/) (SQLite) through
[Drizzle](https://orm.drizzle.team), with [Bun](https://bun.sh) as the package
manager and script runner.

It is a wire-compatible replacement for the Django backend in `../backend`:
same routes, JSON:API documents, cookies, tokens and error messages, so the web,
Electron, iOS and Android clients work unchanged.

## Layout

| Path | Django equivalent |
|---|---|
| `src/db/schema.ts` | models (same table and column names) |
| `migrations/` | migrations (`0001_counter_triggers.sql` replaces the counter signals) |
| `src/lib/ordered.ts` | django-ordered-model |
| `src/lib/jsonapi.ts` | django-rest-framework-json-api (parsing, includes, filters, sort, pagination) |
| `src/lib/validation.ts` | DRF serializer fields |
| `src/resources/*.ts` | viewsets and serializers |
| `src/auth/` | `tearleads.authentication` |
| `scripts/manage.ts` | management commands |
| `scripts/import-postgres.ts` | — (one-time Postgres → D1 import) |
| `test/` | the Django test suite, ported test-for-test |

## Development

```shell
bun install
cp .dev.vars.example .dev.vars   # fill in OAuth client ids/secrets
bun run db:migrate:local
bun run dev                      # http://localhost:9001, as the frontend expects
```

```shell
bun run test             # vitest inside workerd, against a real (local) D1
bun run test:coverage    # fails under 98% line coverage, like .coveragerc
bun run test:scripts     # import + management scripts (bun test), same bar
bun run typecheck
bun run lint
```

Changing the schema: edit `src/db/schema.ts`, then `bun run db:generate` and
commit the generated migration. Triggers and other hand-written SQL go in a
custom migration (`bunx drizzle-kit generate --custom --name <name>`).

## Differences from the Django backend

Deliberate changes:

- **Owner-only reads.** Every list/retrieve is scoped to the requesting user;
  anonymous reads get 403. (Django let anyone list anyone's entries and tags by
  username.)
- **Ordering is scoped.** Tags are ranked per user and tag↔entry junctions per
  tag (`order_with_respect_to`); Django used one global sequence per table.
  Deletes leave gaps instead of compacting ranks. The import re-ranks scopes that
  had tied ranks (see below).
- **Tagging checks ownership.** Creating a junction or a reuse only accepts the
  requester's own tag/entry (400 `Invalid pk`).
- **No password login.** `/api-token-auth/` is gone: the frontend never used it
  and Workers' WebCrypto caps PBKDF2 at 100k iterations, below Django's hashes.
  Django admin is gone too; use `wrangler d1 execute` or `scripts/manage.ts`.
- **Logout actually clears production cookies.** The expiring cookies carry the
  same `Domain` they were set with.
- **CORS origin patterns are anchored** (`http://localhost.evil.com` no longer
  matches `^http://localhost:*`).
- **Staging cookies are scoped to `.staging.commandsnippets.com`** and are
  `Secure`/`SameSite=Strict`: the staging web app can read `LoggedIn`, and they
  never overwrite or clear production's `.commandsnippets.com` cookies of the
  same names (Django staging ran with `DEBUG` on, which made them host-only and
  non-Secure). Production's cookies still reach staging hosts, so the API tries
  each `Authorization` cookie and accepts the first valid token.
- `PATCH`/`PUT` on `/entry_reuses` is 405 (it would desync counters), and
  renaming a tag to an existing name is a 400 rather than a 500.

- **Search folds Unicode in the app.** D1's SQLite has no ICU, so
  `filter[search]` compares against `subject_folded`/`body_folded`, written by
  every entry write path and the import (`src/lib/search.ts`). Anything that
  writes entries outside the API must set them too.
- **Cookie names differ on staging** (`StagingAuthorization`,
  `StagingLoggedIn`), because production's cookies also reach staging hosts.
  Until staging's API moves to v2, the staging frontend also accepts Django's
  `LoggedIn` (a UI hint only; drop the fallback in `authUtils.ts` after
  cutover).

- **`date_updated` comes from D1, not the Worker's clock** (`src/lib/revision.ts`):
  the later of D1's clock and one millisecond past the user's latest row, so
  sync (`filter[date_updated.gt]`) never misses a write because two Workers'
  clocks disagreed.

- **Tagging, untagging and junction reorders advance the entry's
  `date_updated`**, in the same D1 batch as the junction write. Clients sync
  junctions only as `/entries` includes, filtered on the entry's revision;
  Django left entries untouched, so other devices missed those changes.

Unchanged on purpose: timestamps keep Django's naive-UTC microsecond format
(`2024-01-01T12:34:56.123456`), tokens are the same 40-hex DRF keys (existing
sessions keep working), and ids continue from the Postgres sequences.

## Importing the Postgres data

At cutover the dump must be taken **after writes stop**, or anything written
between the dump and the DNS switch is lost. An older backup (such as the ones
`../backend/refresh.sh` downloads) is fine for rehearsals only.

0. **Ship the clients first.** v2's reads are owner-only, so they need the
   auth cookie, and client builds from before this change sent no credentials
   on entry/tag reads (`getEntries`/`getTags`); against v2 they would get 403s
   and reset their sessions. The web app picks the fix up when this merges
   (Frontend CI deploys on `main`); Electron and mobile builds need new
   releases, and enough adoption, *before* the API switches. The Django API
   works with the new clients, so they can ship any time.

1. **Freeze writes.** Stop the Django API on the production host so nothing
   else can change (clients see errors briefly):

   ```shell
   ssh <production-host> 'cd ~/tearleads-backend && docker compose -f compose-container-registry.yaml stop backend'
   ```

2. **Take a fresh dump** on the host, then copy it down:

   ```shell
   ssh <production-host> 'cd ~/tearleads-backend && docker compose -f compose-container-registry.yaml run --rm postgres backup'
   # The newest backup in the volume (as refresh.sh's download_latest finds it):
   ssh <production-host> "sudo sh -c 'ls -t /var/lib/docker/volumes/tearleads_postgres_backup/_data/*-Fc | head -1'"
   ssh <production-host> "sudo cat <that path>" > ~/tearleads-backups/cutover-pg_dump-Fc
   ```

   Check that the backup's timestamp (in its name) is from *after* step 1.
   (`refresh.sh` itself also restores into your local Docker Postgres, which
   the cutover does not need.)

3. **Convert and verify.** This needs `pg_restore` but no Postgres server:

   ```shell
   bun scripts/import-postgres.ts ~/tearleads-backups/<backup>-pg_dump-Fc
   ```

   It writes `data/import.sql` (git-ignored; it contains user data and tokens)
   and verifies it in an in-memory SQLite built from `migrations/`, statement by
   statement: row counts, foreign keys, counters, rank ties, sequence
   positions, cross-user rows, duplicate emails. If the backup is from a newer
   Postgres than your `pg_restore`, use
   `PG_RESTORE="docker run --rm -i postgres:18 pg_restore"`.

4. **Load it** into an empty, migrated database:

   ```shell
   bunx wrangler d1 migrations apply DB --remote --env production
   bunx wrangler d1 execute DB --remote --env production --file data/import.sql
   ```

5. **Switch traffic** to the Worker (attach `api.commandsnippets.com`), and
   leave the Django API stopped.

6. Delete `data/import.sql`.

If anything fails before step 5, restart the Django API
(`docker compose ... start backend`) and nothing was lost.

## Operations

```shell
bun scripts/manage.ts list-users --env production
bun scripts/manage.ts list-recent-logins --env production
bun scripts/manage.ts usage-report --env production [--format csv --output report.csv]
bun scripts/manage.ts delete-user <username> --env production
```

Backups: D1 Time Travel restores to any point in the last 30 days
(`wrangler d1 time-travel restore`); `wrangler d1 export` produces a SQL dump.

## Deployment

One-time setup:

```shell
bunx wrangler d1 create tearleads-staging     # paste ids into wrangler.jsonc
bunx wrangler d1 create tearleads-production
for env in staging production; do
  for name in GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET ELECTRON_GITHUB_CLIENT_ID \
      ELECTRON_GITHUB_CLIENT_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
    sops -d --extract "[\"$name\"]" ../backend/.env-$env.sops.env \
      | bunx wrangler secret put "$name" --env "$env"
  done
done
```

Then attach the custom domains (`api.staging.commandsnippets.com`,
`api.commandsnippets.com`) to the Workers.

CI: pull requests run lint, typecheck, and the coverage-gated tests as the
`backend-v2` lane of the required `CI gate` (see `../docs/ci-merge-gate.md`).
Pushes to `staging`/`main` run `Backend v2 CI`, which applies D1 migrations and
deploys once the `BACKEND_V2_DEPLOY` repository variable is `true` and the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist. Deploys stay
off until then, so merging never deploys against placeholder database ids.
