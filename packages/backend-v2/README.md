# Commandsnippets Backend v2

The Commandsnippets API on Cloudflare Workers: [Hono](https://hono.dev) on
workerd, [D1](https://developers.cloudflare.com/d1/) (SQLite) through
[Drizzle](https://orm.drizzle.team), with [Bun](https://bun.sh) as the package
manager and script runner.

It replaces the Django backend in `../../backend`. Routes, JSON:API documents,
cookies, tokens, timestamps and error messages follow Django's wherever clients
rely on them, but it is not a drop-in replacement: reads are owner-only,
staging has its own cookie names, and staff get an admin API (see
[Differences from the Django backend](#differences-from-the-django-backend)).
The web client must be a build that knows these (see
[Importing the Postgres data](#importing-the-postgres-data), step 0). It is
web-only: the API endpoints and CORS origins that served the retired Electron
and Capacitor apps are gone.

## Layout

| Path | Purpose | Django origin |
|---|---|---|
| `src/index.ts`, `src/app.ts` | Worker entry point; the app: CORS, CSRF, authentication, routes, JSON:API 404/500 | settings (CORS, middleware), `urls.py` |
| `src/env.ts` | bindings, vars and secrets | settings |
| `src/auth/authentication.ts` | the requesting user, from the auth cookie or an `Authorization` header | `CustomAuthentication` |
| `src/auth/cookies.ts` | the auth cookies: per-environment names, domain, expiry | `_create_auth_response`, `deauthenticate` |
| `src/auth/permissions.ts` | `requireUser`, `requireStaff` | DRF `IsAuthenticated`, `IsAdminUser` |
| `src/auth/oauth.ts`, `src/auth/routes.ts` | GitHub and Google OAuth; login and logout routes | the `authentication` app |
| `src/db/schema.ts` | tables (same table and column names) | models |
| `src/db/client.ts`, `src/db/errors.ts` | the Drizzle client; D1 constraint failures | — |
| `migrations/` | D1 migrations (`0001_counter_triggers.sql` replaces the counter signals) | migrations |
| `src/lib/jsonapi.ts` | JSON:API parsing, includes, filters, sort, pagination | django-rest-framework-json-api |
| `src/lib/validation.ts` | request attribute validation | DRF serializer fields |
| `src/lib/errors.ts` | errors in the JSON:API error format | DRF exceptions, DJA's exception handler |
| `src/lib/ordered.ts` | ranked rows (`above`, `below`) | django-ordered-model |
| `src/lib/clock.ts` | naive-UTC microsecond timestamps | `USE_TZ = False` |
| `src/lib/revision.ts` | `date_updated` assigned by D1 | — |
| `src/lib/search.ts` | Unicode search folds | Postgres `UPPER()` in `icontains` |
| `src/resources/{tags,entries,tagsEntries,entryReuses,currentUser}.ts` | the resource routes | viewsets |
| `src/resources/serializers.ts`, `resourceTypes.ts` | resource definitions and type names | serializers |
| `src/resources/viewset.ts`, `owned.ts`, `filters.ts`, `related.ts`, `reorder.ts`, `responses.ts` | shared list, lookup, ownership, soft-delete, filter and reorder behavior | `ModelViewSet`, `IsOwner`, django-filter |
| `src/resources/admin.ts` | the `/api/v1/admin` API for staff | Django admin |
| `src/services/users.ts`, `src/services/tokens.ts` | account creation, reserved usernames, logins; auth tokens | the `users` app; DRF `authtoken` |
| `scripts/manage.ts` | management commands | `manage.py` commands |
| `scripts/import-postgres.ts` | one-time Postgres → D1 import | — |
| `scripts/lib/` | the scripts' shared helpers (migrations, SQL literals, processes) | — |
| `test/` | the Django test suite, ported test-for-test, and v2's own tests | the apps' `tests/` |
| `test/support/`, `test/helpers.ts` | factories, an API client, the base test case | `BaseTestCase`, factory_boy |

## Development

```shell
bun install
cp .dev.vars.example .dev.vars   # fill in OAuth client ids/secrets
bun run db:migrate:local
bun run dev                      # http://localhost:9001, as the frontend expects
```

```shell
bun run test             # vitest inside workerd, against a real (local) D1
bun run test:coverage    # the same, with the src/ coverage gate
bun run test:scripts     # import + management scripts (bun test), own gate
bun run typecheck
bun run lint
```

CI runs both coverage gates:

- `test:coverage` (`vitest.config.ts`): 98% of lines and statements in `src/`.
- `test:scripts` (`bunfig.toml`): 98% of lines and 95% of functions in
  `scripts/`; `src/` counts only toward the vitest gate.

`typecheck` runs two configs that share `tsconfig.base.json`: `tsconfig.json`
for the Worker and its tests (workerd types), and `tsconfig.scripts.json` for
the scripts and the vitest and drizzle-kit configs (Bun and Node types).

Changing the schema: edit `src/db/schema.ts`, then `bun run db:generate` and
commit the generated migration. Triggers and other hand-written SQL go in a
custom migration (`bunx drizzle-kit generate --custom --name <name>`).

## Differences from the Django backend

Deliberate changes, by area. The admin API is new; see
[its own section](#admin-api).

### Access and auth

- **Owner-only reads.** Every list/retrieve is scoped to the requesting user;
  anonymous reads get 403. (Django let anyone list anyone's entries and tags by
  username.)
- **Tagging checks ownership.** Creating a junction or a reuse only accepts the
  requester's own tag/entry (400 `Invalid pk`).
- **Deactivated accounts are locked out.** An `is_active = false` account's
  token is ignored (it is anonymous), and its logins get 403 `This account has
  been deactivated.` Django only checked `is_active` on the retired password
  login.
- **Some usernames are reserved.** Usernames are the web app's first path
  segment (`/:user/:tag`), so its own top-level routes, listed in
  `src/services/reserved-usernames.json` (`admin`, `oauth`), are treated as
  taken in any letter case, and a new account gets the usual `-<digits>`
  suffix instead. The frontend's tests check its routes against the list.
  `0006_rename_reserved_usernames.sql` renamed any existing account with one
  to `<name>-<id>` (staging and production had none), and the Postgres import
  refuses them. Reserving another name takes a migration too (see
  [Operations](#operations)).
- **Web only.** `/api/v1/integrated-oauth/` (native Google sign-in), the
  Electron GitHub OAuth app (`clientType: 'electron'`, now ignored) with its
  `SameSite=None` cookies, and the Electron and Capacitor CORS origins are gone.
- **No password login.** `/api-token-auth/` is gone: the frontend never used it
  and Workers' WebCrypto caps PBKDF2 at 100k iterations, below Django's hashes.
- **Staging has its own cookie names** (`StagingAuthorization`,
  `StagingLoggedIn`), `Secure`/`SameSite=Strict` on `.commandsnippets.com`.
  Staging's hosts are hyphenated first-level names (`app-staging`,
  `api-staging`, `website-staging`: Universal SSL covers only one level below
  the apex), so staging and production share the parent domain and are kept
  apart by name; each API ignores the other's cookies. Django staging ran with
  `DEBUG` on, which made its cookies host-only and non-Secure; those leftovers
  are expired whenever cookies are domain-scoped.
- **Logout actually clears production cookies.** The expiring cookies carry the
  same `Domain` they were set with.
- **CORS origin patterns are anchored** (`http://localhost.evil.com` no longer
  matches `^http://localhost:*`), and a state-changing request from any other
  origin, or a POST that is not JSON, is refused before it reaches a route.

### Data and sync

- **Ordering is scoped.** Tags are ranked per user and tag↔entry junctions per
  tag (`order_with_respect_to`); Django used one global sequence per table.
  Deletes leave gaps instead of compacting ranks. The import re-ranks scopes that
  had tied ranks (see below).
- **`date_updated` comes from D1, not the Worker's clock** (`src/lib/revision.ts`):
  the later of D1's clock and one millisecond past the user's latest row, so
  sync (`filter[date_updated.gt]`) never misses a write because two Workers'
  clocks disagreed.
- **Tagging, untagging and junction reorders advance the entry's
  `date_updated`**, in the same D1 batch as the junction write. Clients sync
  junctions only as `/entries` includes, filtered on the entry's revision;
  Django left entries untouched, so other devices missed those changes.
- **Search folds Unicode in the app.** D1's SQLite has no ICU, so
  `filter[search]` compares against `subject_folded`/`body_folded`, written by
  every entry write path and the import (`src/lib/search.ts`). Anything that
  writes entries outside the API must set them too.
- `PATCH`/`PUT` on `/entry_reuses` is 405 (it would desync counters), and
  renaming a tag to an existing name is a 400 rather than a 500.

### Schema

- **Counters are triggers.** `0001_counter_triggers.sql` maintains tag and
  entry counters in place of Django's signals.
- **Length limits are CHECK constraints**, since SQLite has no varchar lengths.
- **Emails are unique** among accounts that have one (logins find accounts by
  email); the Postgres import refuses shared emails.
- **`is_superuser` is gone.** `is_staff` is the only admin flag. The schema
  and the import stopped using the column in the `0004_admin.sql` release, and
  `0005_drop_is_superuser.sql` drops it (see Deployment).

Unchanged on purpose: timestamps keep Django's naive-UTC microsecond format
(`2024-01-01T12:34:56.123456`), tokens are the same 40-hex DRF keys (existing
sessions keep working), and ids continue from the Postgres sequences.

## Admin API

An admin API replaces Django admin. `/api/v1/admin` is for `is_staff` users
only (403 for everyone else):

- `GET /users` lists every account, with live entry and tag counts.
  Filters: `filter[is_active]`, `filter[is_staff]`, and `filter[search]`
  (username or email). Sorts: `username`, `email`, `date_joined`,
  `last_login`, `login_count`, `entry_count`, `tag_count`.
- `GET /users/:id` returns one account.
- `PATCH /users/:id` changes `is_active`, the only writable attribute.
  Deactivating also deletes the account's token, so its sessions end at
  once. Staff cannot deactivate themselves.
- `GET /audit_log` lists these changes, newest first
  (`filter[target_user_id]`).

Nothing in the API grants staff; see [Operations](#operations).
`GET /api/v1/user` reports the requester's own `is_staff`, which the web app
uses to offer its `/admin` page.

## Importing the Postgres data

The Django API and its hosts were shut down on 2026-09-27, so the production
database no longer changes: import the dump taken before the shutdown (a
`pg_dump -Fc` file).

0. **Host the web app first.** Its S3/CloudFront sites were torn down with the
   Django hosts. It must be a build from after #47: v2's reads are owner-only,
   and earlier builds sent no credentials on entry/tag reads
   (`getEntries`/`getTags`), so against v2 they would get 403s and reset their
   sessions.

1. **Convert and verify.** This needs `pg_restore` but no Postgres server:

   ```shell
   bun scripts/import-postgres.ts <dump-file>
   ```

   It writes `data/import.sql` (git-ignored; it contains user data and tokens)
   and verifies it in an in-memory SQLite built from `migrations/`, statement by
   statement: row counts, foreign keys, counters, rank ties, sequence
   positions, cross-user rows, duplicate emails. If the backup is from a newer
   Postgres than your `pg_restore`, use
   `PG_RESTORE="docker run --rm -i postgres:18 pg_restore"`.

2. **Load it** into an empty, migrated database:

   ```shell
   bunx wrangler d1 migrations apply DB --remote --env production
   bunx wrangler d1 execute DB --remote --env production --file data/import.sql
   ```

3. **Switch traffic** to the Worker (attach `api.commandsnippets.com`).

4. Delete `data/import.sql`.

Nothing reads D1 before step 3, so a failed load can be retried on a freshly
created database.

## Operations

```shell
bun scripts/manage.ts list-users --env production
bun scripts/manage.ts list-recent-logins --env production
bun scripts/manage.ts usage-report --env production [--format csv --output report.csv]
bun scripts/manage.ts delete-user <username> --env production
```

Without `--env` they use the local development database. A bare or unknown
`--env`, like any flag missing its value, prints the usage and exits 2 rather
than falling back to another database.

Grant or revoke staff (access to `/api/v1/admin`) in the database; the API
cannot:

```shell
bunx wrangler d1 execute DB --env production --remote \
  --command "UPDATE users_user SET is_staff = 1 WHERE email = 'someone@example.com'"
```

Reserving another username (adding it to
`src/services/reserved-usernames.json`) needs a migration that renames the
existing accounts that have it, as `0006_rename_reserved_usernames.sql` did;
`scripts/migrations.test.ts` fails without one.

Backups: D1 Time Travel restores to any point in the last 30 days
(`wrangler d1 time-travel restore`); `wrangler d1 export` produces a SQL dump.

## Deployment

One-time setup, after `bunx wrangler login` (`--device` over SSH) or with
`CLOUDFLARE_API_TOKEN` set. The D1 databases are managed by Terraform
(`../../terraform/stacks/{staging,production}`; their ids are in
`wrangler.jsonc`). A Worker must be deployed before it can take secrets:

```shell
for env in staging production; do
  bunx wrangler d1 migrations apply DB --remote --env "$env"
  bunx wrangler deploy --env "$env"
  # Only the Worker's four secrets; the Django files hold many more.
  sops -d --output-type json ../../backend/.env-$env.sops.env |
    jq '{GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID,
         GOOGLE_CLIENT_SECRET}' |
    bunx wrangler secret bulk --env "$env"
done
```

Secrets persist across deploys; rerun the last step only to rotate them.

Migrations run before the deploy (here and in CI), so a migration must work
with the Worker that is still running. Removing a column takes two releases:
first stop reading it (drop it from `src/db/schema.ts`, but not from the
database), then drop it in a later migration. Every request loads the user
row, so dropping a `users_user` column the running Worker still selects fails
every request until the new code is live. `is_superuser` went this way.
`scripts/migrations.test.ts` checks that migrations after the import keep
every row, never rebuild `users_user` (which cascades to all user data), and
leave the database matching `src/db/schema.ts`. Between the two releases, list
the column in its `PENDING_DROPS`.

The Worker's hostname is a custom domain in `wrangler.jsonc`, attached by
`wrangler deploy`: `api-staging.commandsnippets.com` for staging and
`api.commandsnippets.com` for production. workers.dev is off for both.

CI: pull requests run lint, typecheck, and the coverage-gated tests as the
`backend-v2` lane of the required `CI gate` (see `../../docs/ci-merge-gate.md`).
Pushes to `staging`/`main` run `Backend v2 CI`, which applies D1 migrations and
deploys once the `BACKEND_V2_DEPLOY` repository variable is `true` and the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist. Deploys stay
off until then.
