# Commandsnippets Backend v2

The Commandsnippets API on Cloudflare Workers: [Hono](https://hono.dev) on
workerd, [D1](https://developers.cloudflare.com/d1/) (SQLite) through
[Drizzle](https://orm.drizzle.team), with [Bun](https://bun.sh) as the package
manager and script runner.

It replaced the Django backend (retired, and since removed from this repository). Routes, JSON:API documents,
cookies, tokens, timestamps and error messages follow Django's wherever clients
rely on them, but it is not a drop-in replacement: the original collection routes are owner-only,
staging has its own cookie names, and staff get an admin API (see
[Differences from the Django backend](#differences-from-the-django-backend)).
The web client must be a build that knows these. It is web-only: the API endpoints and CORS origins that served the retired Electron
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
| `migrations/` | D1 migrations (`0001_counter_triggers.sql` replaces the counter signals; `0008_tag_revisions.sql` advances tags with their entries; `0009_junction_soft_delete.sql` adds the junctions' `is_deleted` and revision indexes, and `0010_junction_revisions.sql` their triggers: counters and tags that skip deleted junctions, and junctions that advance with their entries; `0019_data_versions.sql` keeps versions that are not active from changing; `0021_own_links.sql` keeps every tagging and reuse within one user's data) | migrations |
| `src/lib/jsonapi.ts` | JSON:API request parsing, includes, filters, sort, pagination (validated by api-shared's schemas) | django-rest-framework-json-api |
| `src/lib/validate.ts` | api-shared's zod issues as JSON:API errors | DRF serializer fields' `is_valid()` |
| `src/lib/errors.ts` | errors in the JSON:API error format | DRF exceptions, DJA's exception handler |
| `src/lib/ordered.ts` | ranked rows (`above`, `below`) | django-ordered-model |
| `src/lib/clock.ts` | naive-UTC microsecond timestamps | `USE_TZ = False` |
| `src/lib/revision.ts` | `date_updated` assigned by D1 | — |
| `src/lib/search.ts` | Unicode search folds | Postgres `UPPER()` in `icontains` |
| `src/resources/{tags,entries,tagsEntries,entryReuses,currentUser}.ts` | the resource routes | viewsets |
| `src/resources/backup.ts` | `GET /api/v1/user/backup`: the requester's data as a backup file | — |
| `src/resources/restore.ts` | `POST /api/v1/user/restore`: a backup as the requester's data, a new data version | — |
| `src/resources/dataVersions.ts` | data versions: `versionOf`, and `/api/v1/user/data_versions` | — |
| `src/resources/userData.ts`, `publicPolicy.ts` | `/api/v1/users/:username/...`: an owner's data, read in full by them or staff and as shared by everyone else; what counts as shared | — |
| `src/resources/lww.ts` | last writer wins for queued client writes (`Client-Updated`, `Client-Write-Id`) | — |
| `src/resources/serializers.ts`, `resourceTypes.ts` | resource definitions and type names | serializers |
| `src/resources/viewset.ts`, `owned.ts`, `filters.ts`, `related.ts`, `reorder.ts`, `responses.ts` | shared list, lookup, ownership, soft-delete, filter and reorder behavior | `ModelViewSet`, `IsOwner`, django-filter |
| `src/resources/admin.ts` | the `/api/v1/admin` API for staff | Django admin |
| `src/services/users.ts`, `src/services/tokens.ts` | account creation, reserved usernames, logins; auth tokens | the `users` app; DRF `authtoken` |
| `src/services/accounts.ts` | staff changes to an account's status (deactivate, reactivate, mark for deletion), audited | Django admin |
| `scripts/manage.ts` | management commands | `manage.py` commands |
| `scripts/lib/` | the scripts' shared helpers (flags, migrations, SQL literals, processes) | — |
| `test/` | the Django test suite, ported test-for-test, and v2's own tests | the apps' `tests/` |
| `test/contract/` | the API's requests and responses against api-shared's schemas | — |
| `test/support/`, `test/helpers.ts` | factories, an API client, the base test case | `BaseTestCase`, factory_boy |

## Validation

Request documents, attributes, relationships and query parameters are
validated with the zod schemas of `../api-shared`, the API contract clients
share: the schemas hold the rules and DRF's exact error messages, and
`src/lib/validate.ts` turns their issues into JSON:API errors. Document and
query errors stop at the first (in DRF's order); serializer fields report every
failing field, in field order. What a schema cannot know stays here: that a pk
exists and is the requester's (`resources/related.ts`, `resources/reorder.ts`),
that a document's id matches the URL's, and what an `include` path reaches
(checked against `resources/serializers.ts`, whose relationships must match
api-shared's `RELATIONSHIPS`). `test/contract/` checks both directions: that
documents the schemas accept, the API accepts (and rejects the rest with the
schemas' messages), and that every response parses with its schema.

api-shared is a `file:` dependency, which Bun installs as symlinks into
`../api-shared`. So `tsconfig.base.json` (`paths`), `vitest.config.ts`
(`resolve.dedupe`) and `wrangler.jsonc` (`alias`, one entry per import:
`zod/mini`, and `zod`) resolve its zod imports to this package's copy. (The
Bun scripts import nothing from it.) After adding or removing files in `../api-shared`, or
changing its `package.json`, run `bun install` here (see
`../api-shared/README.md`).

The schemas are `zod/mini` schemas, so code here types them as
`z.ZodMiniType` (`import type * as z from 'zod/mini'`), and
`src/lib/validate.ts` loads zod's English locale, which zod/mini leaves out.
The API's errors do not depend on it (every failure carries its own
message), but zod's own issues keep reading as they did under classic zod.
zod/mini tree-shakes: it and the schemas are about 97 kB of the Worker's
462 KiB (101 KiB gzipped; measured 2026-10-07 with `wrangler deploy
--dry-run --metafile`), where classic zod alone was about 760 kB of a
1109 KiB Worker (194 KiB gzipped).

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
bun run test:scripts     # management scripts and migrations (bun test), own gate
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

## Routes and headers

| Route | What |
|---|---|
| `GET /healthcheck` | 200, empty |
| `POST /api/v1/github-login`, `POST /api/v1/google-login` | OAuth logins: set the auth cookies |
| `POST /api-token-deauth` | log out: expire the cookies |
| `GET /api/v1/user` | the requester (401 when anonymous), with their `data_version` |
| `/api/v1/tags`, `/entries` | list, retrieve, create, `PATCH`/`PUT`, delete (soft); `POST /tags/reorder` |
| `/api/v1/tags_entries` | taggings: list, create, delete (soft); `POST /reorder`; no retrieve or update (405) |
| `/api/v1/entry_reuses` | reuses: list, retrieve, create, delete; no update (405) |
| `GET /api/v1/user/backup`, `POST /api/v1/user/restore` | [Backups](#backups) |
| `/api/v1/user/data_versions` | [Data versions](#data-versions) |
| `GET /api/v1/users/:username[/tags,/entries,/tags_entries]` | [Public user data](#public-user-data) |
| `/api/v1/admin/...` | [Admin API](#admin-api) (staff) |

Request headers (api-shared's `messages.ts` names each):

- `X-Data-Version`: the data version a client's copy is of. A read naming
  none is of the active one; a write must name one (see
  [Data versions](#data-versions)).
- `X-Expected-User`, `X-Expected-User-Id`: the user, or account, a request
  acts for. Signed in as anyone else, it is a 409 `user_mismatch`, so a tab
  whose session another tab replaced never reads or writes the new user's
  data as its own.
- `Client-Updated`, `Client-Write-Id`: when a queued write was made, and its
  id ([Queued writes](#queued-writes-last-writer-wins)).
- `X-Data-Access` (`public` or `full`), `X-Public-Revision`,
  `X-Data-Owner-Id`: the access a read of a user's data asks for, and the
  public revision and owner it is bound to (a mismatch is a 409
  `view_changed`; [Public user data](#public-user-data)).

Every response names the build that answered in `API-Version` (this
package's version).

## Differences from the Django backend

Deliberate changes, by area. The admin API is new; see
[its own section](#admin-api).

### Access and auth

- **Owner-only reads.** Every list/retrieve of the original collection routes
  (`/api/v1/tags`, `/entries`, ...) is scoped to the requesting user;
  anonymous reads get 403. (Django let anyone list anyone's entries and tags by
  username.) What an owner shares is read through its own routes (see
  [Public user data](#public-user-data)). Django's `filter[user.username]` is
  gone with it: those lists are the requester's own, so it is refused (400).
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
  to `<name>-<id>` (staging and production had none). Reserving another name takes a migration too (see
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
  apart by name; each API ignores the other's cookies.
- **Logout actually clears production cookies.** The expiring cookies carry the
  same `Domain` they were set with.
- **CORS origin patterns are anchored** (`http://localhost.evil.com` no longer
  matches `^http://localhost:*`), and a state-changing request from any other
  origin, or a POST that is not JSON, is refused before it reaches a route.

### Data and sync

- **Creates answer 201 only for a row they make.** A tag create answered with
  the user's tag of that name, or a tagging answered with the pair's junction
  there is (restored if it was untagged), is 200; Django answered 201 either
  way. A create retried with its `client_id` is answered as its first attempt
  was (201 when that attempt made the row).
- **Ordering is scoped.** Tags are ranked per user and tag↔entry junctions per
  tag (`order_with_respect_to`); Django used one global sequence per table.
  Deletes leave gaps instead of compacting ranks. The Postgres import (since
  removed) re-ranked scopes that had tied ranks.
- **`date_updated` comes from D1, not the Worker's clock** (`src/lib/revision.ts`):
  the later of D1's clock and one millisecond past the user's latest row, so
  a sync (keyset reads in `date_updated` order, `page[after]`) never misses a
  write because two Workers' clocks disagreed.
- **Tagging, untagging and junction reorders advance the entry's
  `date_updated`**, in the same D1 batch as the junction write, so a sync of
  `/entries` gets each entry's junctions (its `text_entry_to_tag`) as they
  are after the change; Django left entries untouched, so other devices
  missed those changes.
- **Untagging soft-deletes the junction** (`is_deleted`), and tagging the
  pair again restores it, at the bottom of the tag. A deleted junction is out
  of its tag: out of the counters, `date_last_used`, `filter[tags.id]`, the
  entry's `text_entry_to_tag`, and reorders (it keeps its old rank). An
  entry's revision advances its junctions' too (`0010_junction_revisions.sql`),
  so `GET /tags_entries?filter[tag.id]=<tag>`, which lists deleted junctions,
  after a cursor is everything that changed in the tag: joins, departures,
  re-ranks and edits (`include=text_entry` for the entries). Django had no
  junction list (405) and deleted junctions outright.
- **Keyset pages.** Tags, entries and junctions take `page[after]=<cursor>`
  (api-shared's `cursor.ts`): the rows past `<date_updated>,<id>`, in that
  order, uncounted, with `links.next` while rows are left. Revisions only
  grow (`src/lib/revision.ts`) and a changed row moves past every cursor, so
  a sync that pages until `next` is null misses nothing, even rows one write
  stamped alike (a reorder) that a page boundary splits, which a
  `filter[date_updated.gt]` cursor would skip. Numbered pages are
  unchanged.
- **A tag's `date_updated` advances with its entries.** Whenever one of its
  entries advances (an edit, a soft delete, or any of the junction writes
  above), an entry leaves it, or its counters change, so does the tag
  (`0008_tag_revisions.sql`, triggers in the same statement as the write).
  A client needs to sync a tag only when its revision from the tags sync is
  newer than the one it last synced it at; Django only advanced a tag when
  the tag itself was edited.
- **Search folds Unicode in the app.** D1's SQLite has no ICU, so
  `filter[search]` compares against `subject_folded`/`body_folded`, written by
  every entry write path (`src/lib/search.ts`). Anything that
  writes entries outside the API must set them too.
- `PATCH`/`PUT` on `/entry_reuses` is 405 (it would desync counters), and
  renaming a tag to an existing name is a 400 rather than a 500.

### Schema

- **Counters are triggers.** `0001_counter_triggers.sql` maintains tag and
  entry counters in place of Django's signals. `0008_tag_revisions.sql`
  re-creates the junction triggers so they also advance the tag's revision,
  and adds one that advances an entry's tags whenever the entry's revision
  does. The triggers compute revisions with `src/lib/revision.ts`'s formula,
  written out in SQL.
- **Length limits are CHECK constraints**, since SQLite has no varchar lengths.
- **Emails are unique** among accounts that have one (logins find accounts by
  email).
- **`is_superuser` is gone.** `is_staff` is the only admin flag. The schema
  stopped using the column in the `0004_admin.sql` release, and
  `0005_drop_is_superuser.sql` drops it (see Deployment).
- **`users_user.last_active`** is the time of the user's latest authenticated
  request or login. The token lookup bumps it in the same statement
  (`UPDATE ... RETURNING`), so every request that authenticates writes to D1.
  It does not advance `date_updated`, and only the admin API shows it.
  `0007_user_last_active.sql` started existing accounts at their
  `last_login`.

Unchanged on purpose: timestamps keep Django's naive-UTC microsecond format
(`2024-01-01T12:34:56.123456`), tokens are the same 40-hex DRF keys (existing
sessions keep working), and ids continue from the Postgres sequences.

## Queued writes (last writer wins)

The web app makes its writes locally and sends them later, offline too, in
order. Each names when it was made in the `Client-Updated` header
(api-shared's `CLIENT_UPDATED_HEADER`; a time ahead of the API's clock counts
as now, and a write without one as made now), and itself in
`Client-Write-Id` (`CLIENT_WRITE_ID_HEADER`), the same on every attempt:
every retry counts as the first attempt was counted (`sync_clientwrite`
keeps that time as long as the user), whatever the clock of the isolate it
reaches, so a retry after a lost answer never beats a write made in
between. Tags, entries and
junctions keep the time of the last client write to them
(`client_updated`), and a write to one applies only when it is no older
(`src/resources/lww.ts`): the latest edit wins, whatever order the writes
arrive in. Now is the API's write clock (`sync_clock`): the database's,
which every isolate shares, advanced by at least a microsecond at each
write. A time ahead of it counts as it, no isolate's clock running ahead of
another's makes a later write older, and no two writes share a time. An older write
changes nothing, and is answered with the row as it stands, which the
client stores. Creating a tag of a name the user has, or tagging an entry
already in the tag, still records the time (no revision advances), so an
older delete or untag does not undo it. Reorders apply in arrival order.

A queued tag or entry create carries a `client_id` (the client's local id):
a create naming one the user's tags (or entries) already have answers with
that row, whatever it is called by then, so one retried after a lost answer
is made once (junctions are found by their pair already): a tag keeps the
`client_id` of the create that made it, and `tags_tagclientid` those of the
creates answered with it (of a name the user had). Tags and entries render
the `client_id` of the create that made them, so a client whose create's
answer was lost recognizes the row when it syncs it. Untagging answers with the junction, and untagging one already untagged
changes nothing, so a retried untag is answered as the first was.

## Public user data

`GET /api/v1/users/:username` identifies a data owner without exposing account
details. Its `/tags`, `/entries`, and `/tags_entries` routes reuse the existing
filters, sorts, includes, and pagination. Owners and staff receive full reads;
everyone else receives only public data. `X-Data-Access: public` pins a public
read even for an owner or staff member. These routes accept no writes.

Tags and entries have `is_public`, defaulting to false (including existing rows
in migration `0013`). Owners change it through their existing PATCH routes.
An entry is visible only when it and at least one attached, live, same-owner
tag are public. Public responses omit private tags, entries, junctions, and
their counts. Deleted data and inactive or deletion-marked accounts are hidden.

Migration `0014` adds triggers that advance the owner's `public_revision` on
content, visibility, relationship, or account availability changes. Public
clients send `X-Public-Revision` and `X-Data-Owner-Id` from the owner metadata;
a mismatch returns `409 view_changed`. The API checks the revision again after
serialization, and public clients clear that owner's rows and cursors before
restarting a paginated sync. Public responses use `Cache-Control: no-store`.
Full owner/admin incremental cursors retain their existing behavior.

## Data versions

Every tag, entry, tagging and reuse belongs to one of its user's data
versions (`users_dataversion`, keyed by user and version number), and the
user's reads and writes are of the active one (`users_user.active_version`).
Version 1 is the data an account starts with (a trigger makes it for every
new account); a restore makes the next and makes it active, keeping the one
before as it was. Numbers are never reused (`users_user.last_version`), so a
client's copy of one version is never taken for another's.

- **Scoping.** Every list, lookup, relationship check and include is of
  one version (`src/resources/dataVersions.ts`'s `versionOf`, the viewset,
  `related.ts`, the serializers' loaders): the requester's active one for
  their own data, the owner's for staff and public reads. Unique names and
  client ids are per version (`One tag of same name per user` is on name,
  user and version), and a reorder moves only the version's rows.
- **`X-Data-Version`.** A client names the version its copy is of; a request
  naming another than the active one is a 409 `data_version_changed`, and
  the client clears its copy and syncs again. A read that names none is of
  the active version; a write must name the one it was made against (a 400
  otherwise), so none queued before a restore or a switch lands in the
  version made active.
- **A version that is not active never changes.** The triggers of
  `0019_data_versions.sql` refuse, in the statement that writes, any
  insert into a version that is not active and any update or delete of a
  row of one (and a tagging or reuse of rows of another version), so a
  write that lands after a switch (queued on a device that had not synced
  since) is refused too: a 409 `data_version_changed`. Rows of a version
  being deleted (its `users_dataversion` row gone first) and of an account
  being deleted may change and go.
- **Routes.** `GET /api/v1/user/data_versions` lists the versions, newest
  first, with their origin (`initial`, or `restore` with the backup's user
  and export date) and live counts (api-shared's `dataVersionSchema`).
  `POST /api/v1/user/data_versions/:version/activate` makes one active.
  `DELETE /api/v1/user/data_versions/:version` deletes one that is not
  active, rows and all (400 for the active one). Making another version
  active, by either route, advances `public_revision`, so public views
  sync again. `GET /api/v1/user` and the admin API's users name the active
  version (`data_version`).

## Backups

`GET /api/v1/user/backup` answers with a backup of the requester's data
(403 `not_authenticated` without a session): api-shared's `backupSchema`, a
versioned JSON file (`format`, `version`) rather than a JSON:API document.
It holds every tag, entry, tagging (`tags_entries`) and reuse
(`entry_reuses`) not deleted in their active data version, or in the one
`?version=` names (404 for one they do not have), each with its id, read
in one D1 batch so they are of one moment. A tagging or reuse whose tag or
entry is deleted, or another user's (rows imported from Django), is left
out, so every id a row refers to is in the backup. Counters and dates the
API works out from these rows (`entry_count`, `tag_count`,
`date_last_used`, `reused_count`) are left out too. It is
sent with `Cache-Control: no-store`.

`POST /api/v1/user/restore` takes a backup as its body (any account's, so
data can move between accounts) and makes it the requester's data, as a new
data version made active, answering with its number and how many tags,
entries, taggings and reuses it made (api-shared's `restoreResultSchema`).
Nothing is deleted: the version before stays as it was. It is checked
first, as a create of each row would be (a tag's name, an entry's subject
and body), with every id a row refers to in the backup: anything else is a
400 whose pointer and detail say where (`Invalid backup at /tags/3/name:
...`), and no version is made. It names the version it is made over
(`X-Data-Version`, a 400 when it names none): another than the active one
is a 409, checked when it arrives and again as
its batch's first statement (the active version's row is made again, which
its primary key refuses unless it is the one named), so a restore or switch
that commits in between stops it too. Then, in one D1 batch (one
transaction: a failure anywhere in it undoes all of it), the version is
numbered, recorded (with the backup's user and
export date) and made active, and the backup's rows are made in it anew,
with ids of their own and their `date_created`, tags in the backup's order
and taggings in their tag's; the counters and `date_last_used` follow
from the rows made. Of two restores over one version at once, the first to
commit makes its version; the other is a 409 `data_version_changed`.

Rows go in as JSON (`json_each`), in runs of at most 1 MB per statement,
since D1 caps a bound value at 2 MB.

## Admin API

An admin API replaces Django admin. `/api/v1/admin` is for `is_staff` users
only (403 for everyone else):

- `GET /users` lists every account, with the live entry and tag counts of
  its active data version.
  Filters: `filter[is_active]`, `filter[is_staff]`, `filter[username]`
  (exactly), and `filter[search]` (username or email). Sorts: `username`,
  `email`, `date_joined`, `last_login`, `last_active`, `login_count`,
  `entry_count`, `tag_count`.
- `GET /users/:id` returns one account.
- `GET /users/:id/tags`, `/users/:id/entries` and `/users/:id/tags_entries`
  read the user's data: the same lists (queries, keyset pages, includes) as
  their own `/tags`, `/entries` and `/tags_entries`, scoped to them. Only GET
  is routed. Staff write no one's data but their own: the owner-only routes
  refuse them anyone else's, as they refuse everyone.
- `PATCH /users/:id` changes `is_active` or `marked_for_deletion`, the only
  writable attributes. Deactivating also deletes the account's token, so its
  sessions end at once. Marking for deletion (`date_marked_for_deletion`)
  also deactivates the account and deletes its token; a marked account
  cannot be reactivated until it is unmarked, and unmarking leaves it
  deactivated. Nothing deletes a marked account yet. Staff cannot deactivate
  or mark themselves. A change applies only to the account as it was read: one
  that raced another change is refused (409 `conflict`) and can be retried.
- `GET /audit_log` lists these changes, newest first
  (`filter[target_user_id]`).

Nothing in the API grants staff; see [Operations](#operations).
`GET /api/v1/user` reports the requester's own `is_staff`, which the web app
uses to offer its `/admin` page.

## Operations

```shell
bun scripts/manage.ts list-users --env production
bun scripts/manage.ts list-recent-logins --env production
bun scripts/manage.ts usage-report --env production [--format csv --output report.csv]
bun scripts/manage.ts delete-user <username> --env production
```

`usage-report` counts each user's live (not deleted) tags, entries and
taggings in their active data version, as the admin API does.

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

Database backups (as opposed to a user's backup, above): D1 Time Travel
restores to any point in the last 30 days (`wrangler d1 time-travel restore`,
to a bookmark from `wrangler d1 time-travel info`); `wrangler d1 export`
produces a SQL dump.

## Deployment

One-time setup, after `bunx wrangler login` (`--device` over SSH) or with
`CLOUDFLARE_API_TOKEN` set. The D1 databases are managed by Terraform
(`../../terraform/stacks/{staging,production}`; their ids are in
`wrangler.jsonc`). A Worker must be deployed before it can take secrets:

```shell
for env in staging production; do
  bunx wrangler d1 migrations apply DB --remote --env "$env"
  bunx wrangler deploy --env "$env"
  # The Worker's four secrets, all the files hold (jq keeps it to them).
  sops -d --output-type json secrets/$env.sops.env |
    jq '{GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GOOGLE_CLIENT_ID,
         GOOGLE_CLIENT_SECRET}' |
    bunx wrangler secret bulk --env "$env"
done
```

Secrets persist across deploys; rerun the last step only to rotate them.

Each release, from this directory, for staging and then production (CI does
not deploy; see below):

```shell
bunx wrangler d1 time-travel info DB --env "$env"   # keep the bookmark
bunx wrangler d1 migrations apply DB --remote --env "$env"
bun run deploy:$env   # wrangler deploy; it applies no migrations
bunx wrangler deployments list --env "$env"
```

The web app (`../frontend`, `bun run deploy:$env`) goes after the API when it
needs something the API adds, and before it when the API removes something
older builds read (an attribute their schemas require). The `API-Version`
response header is this package's version, so a request shows which build
answered.

Migrations run before the deploy, so a migration must work with the Worker
that is still running. Removing a column takes two releases:
first stop reading it (drop it from `src/db/schema.ts`, but not from the
database), then drop it in a later migration. Every request loads the user
row, so dropping a `users_user` column the running Worker still selects fails
every request until the new code is live. `is_superuser` went this way
(`0005`), `date_restored` (`0020`), and Django's `first_name`, `last_name` and
`reused_date` (`0022`). A column the Worker only writes, never reads, can go in
one release, at the cost of the writes in between: `authtoken_token.created`
(`0022`).
`scripts/migrations.test.ts` checks that migrations after `0003` (the schema
production's data was imported into) keep every row, never rebuild `users_user` (which cascades to all user data), and
leave the database matching `src/db/schema.ts`. Between the two releases, list
the column in its `PENDING_DROPS`.

The Worker's hostname is a custom domain in `wrangler.jsonc`, attached by
`wrangler deploy`: `api-staging.commandsnippets.com` for staging and
`api.commandsnippets.com` for production. workers.dev is off for both.

CI: pull requests run lint, typecheck, and the coverage-gated tests as the
`backend-v2` lane of the required `CI gate` (see `../../docs/ci-merge-gate.md`),
for changes here or in `../api-shared`. Pushes to `staging`/`main` that change
either run `Backend v2 CI`, whose deploy job would apply D1 migrations and
deploy, but only once the `BACKEND_V2_DEPLOY` repository variable is `true`
and the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist.
Neither is set, so CI never deploys: releases are deployed by hand, as above.
