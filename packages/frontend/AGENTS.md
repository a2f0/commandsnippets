# AGENTS.md

This file provides guidance to AI coding assistants when working with code in
this package. The repository-wide conventions (commits, branches, PRs, review
focus) are in the root `AGENTS.md`.

## Project Overview

The Commandsnippets web client: a command snippet tool for programmers and
system administrators. Snippets (entries) are tagged, and both tags and
entries can be put in a user-defined order. The API is backend-v2
(`packages/backend-v2/`).

## Development Commands

Run these from `packages/frontend`.

### Setup
- Requires Bun, and Node.js at the `.nvmrc` version (Vite, Vitest, WebdriverIO
  and wrangler run on it)
- `bun install` - Install dependencies
- `bun run dev` - Start the development server on http://localhost:8085
- `bun run server-test` - Start the server in test mode on
  http://localhost:8081, with the API mocked by MSW (what the E2E tests use)

### Code Quality
- `bun run lint` - Biome lint
- `bun run format` - Check formatting with Biome (reports, does not write)
- `bun run fix` - Fix lint and formatting issues (`biome check --write`)
- `bun run compile` - TypeScript check (`tsc -b --force`), which `bun install`
  also runs (`prepare`). `--force` rebuilds every project each time (about 2
  seconds) instead of reusing `.ts-out`: TypeScript 7.0.2's incremental build
  leaves stale declarations when one build changes a global declaration file
  (such as `types/window.d.ts`) along with other types
  (microsoft/typescript-go#4664), so after a pull or checkout `tsc -b` failed
  with errors like `Type 'string' is not assignable to type '"Tag"'` (and can
  miss real errors the same way). Keep `--force` until a TypeScript release
  has the fix (typescript-go#4665, so far only in the 7.1 dev builds);
  `__tests__/infra/compile.spec.ts` fails if `compile` leaves stale output.

### Testing

#### Unit Tests (Vitest)
- `../../scripts/runUnitTests.sh` - Run all unit tests, as CI does (it disables
  Node's experimental Web Storage, which would replace jsdom's `localStorage`)
- Pass paths to run specific files, for example
  `../../scripts/runUnitTests.sh __tests__/integration/reorderEntryList.spec.tsx`
- For watch mode, run
  `NODE_OPTIONS=--no-experimental-webstorage bunx vitest` in a terminal.
  `bun run unit -- --watch` fails: `unit` already passes `--no-watch`.

#### E2E Tests (WebdriverIO, Chrome only)
- `../../scripts/runWebdriverTests.sh` - Start the test server and run the
  headless suite, as CI does (`bun run ci-headless`)
- `scripts/runSpecHeadless.sh <spec-file>` - Run one spec headless, for
  example `scripts/runSpecHeadless.sh test/specs/tags/search.spec.ts`
- `scripts/runSpec.sh <spec-file>` - Run one spec in a visible browser
- `bun run test-headless` / `bun run test` - Run the suite against a
  `bun run server-test` you started yourself

### Build and Deploy
- `bun run build` - Production bundle in `build/`
- `bun run build:staging` / `bun run build:production` - Build in that mode
  (`.env.staging` / `.env.production`)
- `bun run build:analyze` (or `bun run analyze`) - Build with bundle analysis
- `bun run clean` - Remove `build/`
- `bun run deploy:staging` / `bun run deploy:production` - Build for the
  environment and `wrangler deploy` it (see the README's Deploying section)

## Architecture

### State
The user's data (tags, entries, junctions) is in IndexedDB, synced with the
API; everything else the app keeps is a zustand store.
- **App state**: `src/lib/state/appState.ts`, a zustand store (`useAppState`)
  of who is signed in, their preferences and what the UI is doing. The
  signed-in user and their preferences (theme, sort orders, tag counts) are
  saved to `localStorage` (`commandsnippets-<environment>`, zustand's persist
  format, merged over the defaults); the rest starts afresh with each page.
  Tabs share it: a tab saves only while the saved sign-in is the one it
  last read or wrote, so a stale tab never saves its user back over another
  tab's sign-in (`guardedStorage`).
  Components read one field with a selector
  (`useAppState(state => state.tagSortOrder)`), or the whole state with
  `useAppConfig()`: one object that stays the same across renders (a safe
  hook dependency) and reads the current state on every access, rendering
  again when a field it read changes (`useSyncExternalStore`, so a change
  before it subscribed counts too). Code outside React uses
  `useAppState.getState()`. `resetApplicationState()` signs out here: every
  setting back to its default; `signOut()` ends the API's session first (the
  logout menus).
- **Signing out deletes the user's data**: the store deletes a user's
  IndexedDB database whenever `loggedInUser` leaves them, however it
  happens (the menu, the cookie gone, a session the API ended, another
  sign-in; `endSyncSession`), unless writes are still queued in it (the
  session expired offline, say): it is kept, queue and all, and the user's
  next sign-in here sends them (`discardQueued` deletes it all the same).
  `signedOutDataCleanedUp()` settles once that is done. The logout menus
  sign out through `requestSignOut` (`src/lib/state/signOutWarning.ts`):
  the queue is sent first (waiting `signOutTiming.flushWaitMs` at most), and writes
  still unsent bring up a warning (`SignOutWarning`): stay, sign out
  keeping them on this device, or discard them
  (`signOut({discardQueued: true})`). Kept data is bound
  to the account's id (`bindOwner`, before any flush or sync; `claimData`
  at sign-in): another account that takes a deleted account's name never
  sees its data nor sends its queue. Writes hold the
  database's Web Lock shared and the cleanup holds it exclusively
  (`withDataLock`), so a write another tab makes meanwhile is never
  deleted unsent.
- **The user's data**: `src/lib/db/database.ts`, a Dexie database per
  environment and signed-in user (`commandsnippets-<environment>-<username>`)
  of tags, entries and junctions (deleted ones too) as api-shared's
  resources, the sync's `cursors`, and the queued writes (`outbox`; schema
  version 2). Every row is keyed by its owner's
  username (`[owner+id]`): the signed-in user's own data, and for staff the
  data of other users they read, sit side by side, and every query names
  whose. `src/lib/sync/session.ts` opens the database for the signed-in user,
  with a session per owner (`syncSession(username, owner)`: its sync, and
  `readOnly` for another user's); sessions end when another tab deletes or
  upgrades the database, and the next opens it anew.
- **Another user's data (staff)**: on another user's page (`/:user`), staff
  read that user's full data (`useOwner` in `src/lib/data/hooks.ts`). It syncs through the admin API's read-only
  routes (`adminSyncApi`, `GET /admin/users/:id/tags` ...) into the signed-in
  user's database under that user's name, and signing out deletes it with
  the rest. The page is read-only: a badge in the menu bar
  (`ReadOnlyBadge`), no New Tag or New Entry, no tag or list context menus,
  only Copy on an entry's, no drag and drop (`useReadOnly`), and a
  read-only session's writes throw `ReadOnlyError` before anything is sent.
  The admin users table opens it (View data).
- **Public user pages**: guests and non-staff visitors use the same
  `/:user/:tag` and `/:user?entries=all` routes, read-only. Tags and entries
  default to private; owners toggle each in its context menu. An entry must
  be public and have at least one live public tag; private tags and links
  are omitted, and public untagged lists are empty. `publicSyncApi` reads
  `/users/:username` and its collection routes with public access pinned.
  `publicSyncSession` uses `commandsnippets-public-<environment>`, separate
  from full owner/staff caches. Each owner's `public_revision` invalidates
  their rows and cursors together; a generation change during pagination
  clears that owner's cache and restarts the sync. An unavailable owner
  clears their public cache. Collection sync still runs every half minute.
- **What the UI shows**: `src/lib/data/hooks.ts`, live queries of the
  owner's rows in the database (Dexie's `liveQuery`: `useTags`,
  `useTagEntries`, `useEntries('all' | 'untagged')`, of the session
  `useSession` gives), so a list shows each change the moment a sync or a
  write stores it, in any tab. The tags are one query per session that
  every reader shares (the tag list, the entry list), and `useTagNamed`
  looks the tag shown up in it: a tag switch reads only the tag's entries.
  `src/lib/data/sort.ts` sorts and
  searches them (case-insensitively in any script, as the API's search).
  Deleted tags and entries are left out; untagged entries are those in no
  tag.
- **Writes, local first**: `src/lib/data/writes.ts` changes the database at
  once and queues the write in the same transaction (the `outbox` table,
  `src/lib/sync/outbox.ts`), so the app works offline and no write waits on
  the network; then the queue is flushed, not waited for. Rows made here
  have local ids (`local-...`) until their create reaches the API, whose id
  then replaces it everywhere (rows, queued writes, the selection in every
  tab: `subscribeRemaps`, over a `BroadcastChannel`). The row keeps its
  local id (`localId`), and the lists key rows by it (`keyOfRow`), so a row,
  and an editor open on it, stays the same component. A queued tag or entry
  create sends its local id as `client_id`, so a retry makes it once, and a
  sync that reads the row it made before its answer came (a lost answer)
  adopts it (`adoptCreates`): the create is unqueued and the API's id
  replaces the local one, so the row is never shown twice. Writes are
  checked against api-shared's request schemas first (`InvalidWriteError`):
  one the API would refuse is never queued, and its editor keeps it.
- **The queue** (`flushOutbox`, run by the sync engine's `flush`, under the
  same lock as the syncs): writes go in order, each naming when it was made
  (`Client-Updated`, api-shared's `CLIENT_UPDATED_HEADER`: the API keeps the
  newer of two writes to a row, last writer wins by edit time), itself
  (`Client-Write-Id`, the same on every attempt: a retry of a write made
  ahead of the API's clock counts as made when it first arrived) and the
  signed-in user (`X-Expected-User`, `EXPECTED_USER_HEADER`, on the reads
  the queue makes too; the API refuses it when the cookie is another
  user's: 409 `user_mismatch`, `UserMismatchError`, and the tab leaves the
  session). Each answer is the
  row as the API holds it, stored in place of the local one (`force`). A
  write that fails for a reason that can pass (offline, a 5xx) stops the
  flush and is retried; one the API refuses (a 400 or 404) is dropped, with
  the writes that needed a row it would have made, and the rows are put
  back as the API holds them (`getTag`, `getEntry`, `getJunction`).
- **When the data syncs**: `src/lib/data/useSync.ts`. The entries page
  flushes the queue, then syncs the collection, when it opens, when it comes
  back into view or online, and every half minute while in view
  (`useCollectionSync`); the tag shown syncs on its own
  whenever it is not synced through the revision the database holds, and
  every half minute while not (`useTagSync`). A sync that finds the API
  answering for another user leaves the session (`leaveForeignSession`):
  it takes up the sign-in another tab saved since, or signs out. When
  another tab deletes
  the database (a sign-out there), `useSession` renders again with the next
  session.
- **The sync**: `src/lib/sync/sync.ts`, keyset reads (`page[after]`,
  api-shared's `cursor.ts`) from the stored cursors, one sync at a time (a
  Web Lock across tabs), so each response is stored in the order it was
  read. `syncAll` reads the tags, then the entries with their junctions,
  after the master cursors `tags` and `entries` (from the start on a fresh
  sign-in), storing each page with its cursor in one transaction, so a sync
  resumes where one stopped. Pages hold 100 rows (`SYNC_PAGE_SIZE`), the
  API's maximum (its default is 50). On a first collection load,
  `getEntryCount` reads the numbered list's count with a one-row request,
  including deleted rows just like the cursor reads. The entry cursor's
  `initialLoad` keeps the completed page count, total and completion flag
  with each page; `InitialLoadProgress` shows the current page and a bar
  until loading finishes, or an interruption with a retry. A failed count
  uses an indeterminate bar and still loads all pages. Older cursors without
  this marker continue syncing without a first-load indicator. When the
  entries are read to the end, every tag
  gets a cursor of its own (`tag:<id>`: the newest junction revision when the
  sync began, and the tag's revision). `syncTag` reads one tag's junctions
  (`GET /tags_entries?filter[tag.id]=`, deleted ones too: entries that left
  it) after its cursor, from the start without one; a tag sync asked for
  while the collection syncs runs between two of its pages. A tag is synced
  while its cursor holds its revision (`isTagSynced`). Each sync first checks
  the API reads the owner's data (`SyncApi.getOwner`: `GET /user/` for the
  signed-in user's own, the admin API's user for another's), and refuses a
  page with anyone else's rows (a stale tab after someone else signed in).
- **What a sync stores**: `src/lib/sync/store.ts`: each resource unless a
  write to it is still queued (the user's write stands until it reaches the
  API), or the database holds a newer revision of it (revisions compare
  within a table); an entry stored decides its junctions (its
  `text_entry_to_tag` lists all of them not deleted, so the ones it leaves
  out are deleted, but for a tagging still queued), and an older copy of an
  entry leaves them alone; at the same revision, a deleted copy stays
  deleted (a delete worked out from an entry's listing). A device's own
  write comes back from a sync at the revision its answer stored, and
  changes nothing: no cursor ever moves on a write's answer.
- **Signing out when the session is gone**: `fetchWithAuth`
  (`src/lib/api/fetchWithAuth.ts`) calls `handleUnauthorized`
  (`src/lib/auth/authUtils.ts`) on a 401, and on a 403 whose first JSON:API
  error `code` (`src/lib/api/errorDocument.ts`) is `not_authenticated` or
  `authentication_failed` or that has no code; other 403s
  (`permission_denied`, `origin_not_allowed`) keep the session, and so does
  any OK response, whatever its body. `appState.ts` registers the handler:
  `resetApplicationState`, when the request was sent as the user still
  signed in (a late answer to a session the tab has left changes nothing). `authUtils` must not import the
  store: the store imports the sync, which imports the API client, so that
  would be an import cycle.
- **Backups**: `src/lib/data/backup.ts`, api-shared's `backupSchema`
  (every tag, entry, tagging and reuse not deleted, with its id). Both send
  the queue (`flush`) first, then act as the user and the account their
  data is bound to (`forAccount`), as the queue's writes do.
  - File > Export Backup (`ExportBackup.tsx`) saves the API's backup
    (`GET /user/backup`) as
    `commandsnippets-backup-<username>-<YYYY-MM-DD>.json`; a backup of any
    other account is refused (`BackupAccountError`).
  - File > Restore Backup (`RestoreBackup.tsx`, `RestoreBackupDialog.tsx`)
    reads a backup file (any account's: data moves between accounts) and
    checks it (`readBackupFile`), then warns: all of the user's tags and
    entries are deleted (counted as this device holds them) and replaced
    with the backup's, which cannot be undone. Only the confirmation sends
    it (`POST /user/restore`, which makes the rows anew, with new ids); the
    data then syncs here (the deletes come in like any others). The API's
    reason for refusing a backup is shown (`ApiRequestError.detail`).
  - When the queue cannot be sent or the API fails, nothing is saved or
    restored and a dialog says so. Another user's page offers neither (they
    would read as that user's data).

### Timings (the HUD)
Outside production, the app times its work for the HUD's Analytics tab
(`src/lib/metrics/timings.ts`, in memory: the latest 2000 timings and 20
interactions; production records nothing, copies no response body, and has
no HUD). A change of the signed-in user clears them (`appState.ts`), as it
does the user's data, since interactions name tags; work begun before a
clear is not recorded when it ends.
- **What is timed**, by kind: `network`, every `fetchApi` (method and
  path, ids as `:id`; to the end of the body, read from a clone, with status
  and size); `idb`, the lists' live queries (`lib/data/hooks.ts`, by hook
  name), the sync's page stores, `isTagSynced` and `bindOwner`, and the
  user's writes (`timed`); `render`, `EntriesPage`, `TagList` and `EntryList`
  (`useRenderTiming`: render start to layout effect) and every commit of the
  page but the bottom bar (`<Profiler onRender={recordCommit}>` in
  `EntriesPage.tsx`; the HUD is left out, or showing timings would time
  itself). Staging builds alias `react-dom/client` to `react-dom/profiling`
  (`vite.config.ts`), since Profilers do nothing in React's production build.
- **Interactions**: a tag click (or Enter in the tag list, or All/Untagged
  Entries) calls `beginInteraction`; `EntryList` calls `listShown` once it
  renders the list asked for with its own rows (the list hooks name what
  their rows are of: a live query answers with the last rows until it reads
  the next), and the interaction ends at the next paint, unless another has begun or another
list is shown by then. Its timings
  (`timingsOf`) are those from the click to the paint, and the work that
  follows on until the app idles 100 ms.
- **The tab** (`src/components/bottomBar/analytics/`): the interaction's
  click-to-paint time, how long each kind was busy before the paint, and a
  waterfall of its timings; then every timing in a window (log-scale
  scatter) and a table by name (count, p50, p95, max, total). The expanded
  HUD fills the window but for a 16px margin.

### API
The API's contract is `@commandsnippets/api-shared` (`packages/api-shared`, a
`file:` dependency; see the README's "The API contract"): zod schemas for
every request and response document, the error `CODES`, and the types
inferred from them. Take anything that crosses the wire from it rather than
writing its type by hand.
- `src/lib/api/apiClient.ts` - the JSON:API client for tags, entries and
  auth. Every request sends the auth cookie (`credentials: 'include'`), its
  body is api-shared's request document (`TagCreateDocument`, ...), and every
  response the client returns is parsed with its endpoint's document schema
  (`tagListDocumentSchema`, ...). The calls that return nothing (the logins,
  deletes and reorders) leave the body unread.
- **A response that breaks the contract** (OK, but not JSON or not a document
  its schema accepts) throws `InvalidResponseError`
  (`src/lib/api/parseResponse.ts`): `<failure>: invalid response (<path>:
  <issue>; ...)`, naming paths and types, never values. The call fails like
  any failed request: its caller logs it, nothing from the body reaches the
  store (a sync parses every page before it stores any), and the user stays
  signed in (only the rule below signs out).
- `src/lib/api/adminApi.ts` - the staff-only admin API, which handles its own
  401/403 responses and parses with api-shared's schemas; a response that
  breaks the contract is an `AdminApiError` with status 0. `adminSyncApi`
  reads another user's data (read-only) for the sync.
- `src/lib/api/errorDocument.ts` - the first error's `code` and `detail` from
  an error response, each read on its own. Branch on `CODES`
  (`CODES.permissionDenied`), never on the detail.
- `src/lib/api/baseUrl.ts` - the API URL for the environment, which
  `src/lib/environment.ts` derives from the page's hostname and port.
- `src/lib/api/responses/types.ts` - the JSON:API resources as the store's
  models hold them (`ITagJsonApi`, `ITextEntryJsonApi`, ...), derived from
  api-shared's resource types. The models' `type`s are literals, so their
  instances are these types.
- **Query parameters** are api-shared's too: `TagListParams`,
  `TextEntryListParams`, `AdminUserListParams`, ... (from
  `@commandsnippets/api-shared/requests`), which name each collection's
  filters, sort keys and include paths, so a parameter the API would refuse
  does not compile. `apiClient.ts` and `adminApi.ts` take them and
  `src/lib/api/searchParams.ts` writes them as a query string. The app's
  reads are the sync's keyset pages (`getTagsAfter`, `getEntriesAfter`,
  `getTagJunctionsAfter`, `getNewestJunction`).
- **Import the smaller entries** of api-shared (`/responses`, `/messages`,
  types from `/requests`) and only `zod/mini`: a runtime import of classic
  `zod` puts nearly all of it in the bundle (`__tests__/src/lib/api/zod.spec.ts`
  fails on one).

### Source layout
- **App shell** (the root of `src/`): `index.tsx` (the entry point),
  `AppRouter.tsx`, `App.tsx` (the providers), `Routes.tsx` and
  `routePaths.ts`
- **Pages**: `src/pages/`, one component per route: `EntriesPage.tsx`
  (`/:user/:tag`), `AdminPage.tsx` (`/admin`) and `SignInPage.tsx` (`/` when
  signed out)
- **Components**: `src/components/<feature>/`: `entries/` and `tags/` (the
  lists, their editors, context menus and styled fields), `admin/` (the admin
  page's tabs), `auth/` (the GitHub and Google sign-in buttons, which are also
  the OAuth callback routes), `bottomBar/`, `drawer/`, `dnd/` (drag handles
  and the React DnD item types) and `errorBoundary/`. Components shared by
  several features (`AppHeader`, `LanguageSwitcher`, `UserProfileCircle`) sit
  at the root of `src/components/`.
- **Menu bar**: `src/menu/MenuBar.tsx`; each menu is in `src/menu/<name>/`
  (its items in `menuItems/`), and `src/menu/StyledMenu.tsx` and
  `StyledMenuItem.tsx` are their shared drop-down and item (the context menus
  use the item too)
- **Shared styling**: `src/styled/` holds small styled components used across
  features; `src/theme/` the MUI themes, the theme provider, the global
  styles and the shared `sx` objects (`sx.ts`). The app is grayscale: the
  themes make every palette color gray (primary, secondary and the status
  colors), and `__tests__/src/theme/themes.spec.ts` fails on a color with a
  hue in the themes or hard-coded in `src/`, `public/` or `index.html`
- **Non-UI code**: `src/lib/` (the API clients, auth, the app state
  (`state/`), the Dexie database (`db/`), its sync (`sync/`), what the UI
  reads and writes (`data/`), the router (`router/`), and helpers), `src/hooks/`, `src/providers/`,
  `src/i18n/` and `src/msw/`
- **Routes**: `src/Routes.tsx`; the first path segment is a username
  (`/:user/:tag`)
- **Libraries**: Material UI, Emotion (styled components), React DnD
  (reordering), i18next (`src/i18n/`)

### Routing
The app's own router, `src/lib/router/` (no React Router: its hooks render
every component that calls them on any change of the URL, `React.memo` or
not, so a tag switch rendered every tag and entry row and the whole page).
- `route.ts`: `routeOf(pathname)`, the page (`admin`, `githubOAuth`,
  `googleOAuth`, `user`, `root`, `none`) and a user's page's `user` and
  `tag`, decoded and matched as React Router matched them.
- `navigation.ts`: the URL as an external store. Read it through a selector
  that returns a value, never an object: `useRoute(route => route.page)`,
  `useRouteParam('user' | 'tag')`, `useSearchParam('entries')`. A component
  renders again only when what it selects changes, so select the least it
  needs (whose page, not which tag; `route.tag !== undefined`, not the tag).
  Event handlers and effects read it without subscribing (`currentRoute()`)
  and change it with `navigate(to, {replace})`, a function, not a hook.
- `Router.tsx`: `Router` (the browser's history, or a test's memory history
  from the `history` package: `TestAppRouter`), `Navigate` (a route that
  sends elsewhere) and `Link` (for MUI's `component` prop).

### Rendering long lists
A tag switch mounts a list's rows, and the tag list holds every tag, so
per-row work multiplies (the HUD's Analytics tab times it).
- Rows (`Tag`, `Entry`) are `React.memo`, and render again only for what
  they show: narrow store selectors (`useAppState(state => state.x === id)`),
  route values (`useRouteParam`), stable callbacks.
- A row's context menu is rendered only while it is open (MUI's
  `keepMounted` off), and takes where it was opened (`mouse`) and `onClose`
  from the row: never a copy of a prop in state, set again by an effect,
  which renders every row a second time after it mounts.
- What a row needs of its data comes from its props (the tag's
  `is_public`), not a live query of its own: one query per row is one
  IndexedDB transaction per row.

### Top-level routes
- Every top-level route in `src/routePaths.ts` must also be a reserved username
  in backend-v2 `src/services/reserved-usernames.json` (usernames are the first
  path segment); `__tests__/src/routePaths.spec.ts` checks this

### Testing Setup
- **Mock Service Worker (MSW)**: `src/msw/` mocks the API in the browser. Only
  test mode (`bun run server-test`) starts it, from `src/index.tsx`; see
  `src/msw/README.md`. The service worker is `public/mockServiceWorker.js`.
- **Mocks follow the API contract**: the MSW handlers, `__tests__/util/msw.ts`
  and the fixtures in `test/mocks/` answer as the API does, and
  `__tests__/src/msw/contract.spec.ts` parses every response with
  api-shared's schemas (losing nothing), failing on drift or on a handler it
  does not check. Type mock documents with api-shared's types, and build their
  pagination, timestamps and error documents with `src/msw/documents.ts`.
  The handlers of `POST /entries`, the `PATCH`es and `/tags_entries` parse the
  request document as the API does (`src/msw/requests.ts`) and keep the mock
  state as its database would (revisions, counters, junctions: deletes are
  soft, and untagging keeps the junction for the junction list; reorders
  move rows as django-ordered-model does, so the fixtures' ranks are
  distinct);
  `__tests__/src/msw/handlers.spec.ts` checks them. Keyset pages
  (`page[after]`, `src/msw/keyset.ts`) of `/tags`, `/entries` and
  `/tags_entries` answer as the API does. The mock's data: four tags, entries
  1 and 2 in tag 1, and entry 3 in no tag.
- **Vitest**: specs in `__tests__/`, in jsdom. `__tests__/setup.ts` loads the
  jest-dom matchers and stubs `scrollIntoView`; `vite.config.ts` also loads
  `fake-indexeddb/auto`. Unit specs mock the API with `msw/node`
  (`__tests__/util/msw.ts`). The specs are in three places:
  - `__tests__/src/` mirrors `src/`: the spec for `src/pages/AdminPage.tsx` is
    `__tests__/src/pages/AdminPage.spec.tsx`
  - `__tests__/integration/` renders the whole app (`TestAppRouter`) to test a
    behavior across modules, such as reordering or signing out when the
    session is gone
  - `__tests__/infra/` checks the hosting and the build: `hosting.spec.ts`
    builds the app and serves it with `wrangler dev`,
    `wranglerConfig.spec.ts` checks `wrangler.jsonc`, and `compile.spec.ts`
    runs `bun run compile` in a copy of the package across a type change
- **WebdriverIO**: specs in `test/specs/`, run in Chrome only
  (`test/wdio.shared.conf.ts`, `test/wdio.headless.conf.ts`), with a page
  object in `test/pageobjects/` and response fixtures in `test/mocks/`.
- **Build**: Vite 8 with vite-plugin-pwa; TypeScript project references
  (`src/`, `test/`, `__tests__/`) compile into `.ts-out`.

## Documentation Maintenance

- When you find errors in the documentation (outdated commands, wrong
  descriptions) or places it could be clearer, update this `AGENTS.md`.

## Development Guidelines

### Committing and Pull Requests
- Follow the root `AGENTS.md`: conventional commits with a header of 50
  characters or fewer, signed commits with no `Co-authored-by` trailers, and
  the `ship-pr` skill to commit, review, open, squash-merge and reset.
- Never use `--no-gpg-sign` or create unsigned commits, and never force-push a
  shared branch.
- Only commit when explicitly asked to in the current message.

### File Naming
- Component files are PascalCase (`EntryList.tsx`); every other file is
  camelCase (`fetchWithAuth.ts`).
- Directories are camelCase too (`bottomBar/`, `menuItems/`).

### Linting & Formatting
- Run `bun run lint` and `bun run format` to check changes
- Use `bun run fix` (`biome check --write`) to fix issues
- Never add linting or formatting exceptions in code

### Dependencies
- Always pin dependencies to exact versions (no ^ or ~ prefix) when adding or updating packages
- Use `bun add --exact <package>` for new dependencies
- Use `bun add -d --exact <package>` for new dev dependencies
- When manually editing package.json, ensure version numbers have no range specifiers
- Always run `bun install` after modifying package.json to update bun.lock
- Never commit package.json changes without the corresponding bun.lock updates
- When removing dependencies, use `bun remove <package>` to update both package.json and bun.lock
- A new dependency with an install script it needs must be added to `trustedDependencies`; see the README's Dependencies section
- `@commandsnippets/api-shared` is `file:../api-shared`: run `bun install` here after adding, moving or removing a file there or changing its `package.json`, or after editing one with an editor that saves by replacing the file (see the README's "The API contract")
- Vite pre-bundles api-shared into `node_modules/.vite` and does not notice when it changes: if the dev or test server (and so the E2E suite, as "MSW not ready") fails with `does not provide an export named ...` from `.vite/deps/@commandsnippets_api-shared_...`, delete `node_modules/.vite`

### TypeScript
- Always run `bun run compile` after making changes to ensure TypeScript compiles (not a bare `tsc -b`, which can reuse stale output; see Code Quality)
- Never use `any` as a type, or `as` for type assertion
- **Use invariant for strict null checks**: When working with potentially null DOM elements or values that should exist but may be null according to TypeScript, use the `invariant` library for runtime assertions:
  ```typescript
  import invariant from 'invariant';

  // Instead of:
  const element = container.firstElementChild;
  const styles = window.getComputedStyle(element as Element);

  // Use:
  const element = container.firstElementChild;
  invariant(element, 'element should exist');
  const styles = window.getComputedStyle(element);
  ```
- This approach provides better error messages and satisfies TypeScript's strict null checks without unsafe type assertions

### Package Manager
- Always use `bun` for the JavaScript package manager

### Language
- Always write code in TypeScript, never JavaScript

### Console Output & Logging
- **Never use colored emojis** (🚀🔨📱✅❌⚠️🔍📁🧪📊🔄) in console output, error messages, or logging
- Use clear ASCII text prefixes instead: `OK:`, `ERROR:`, `WARNING:`, `SUCCESS:`, `PASS:`, `FAIL:`
- Unicode characters for expression are acceptable (e.g., →, ×, ✓ as text), but avoid colorful emoji characters
- Keep output professional and terminal-friendly

**Example:**
```typescript
// DO NOT:
console.log('✅ Build completed successfully');
console.error('❌ Build failed');

// DO:
console.log('OK: Build completed successfully');
console.error('ERROR: Build failed');
```

### Testing
- After changing E2E specs or `test/mocks/`, run the unit tests too
  (`../../scripts/runUnitTests.sh`): some unit specs import those mocks.
- Unit tests are Vitest specs in `__tests__/`. Helpers in `__tests__/util/`:
  - `signIn.ts` - `signIn()` (as the mock API's user, `test`), `resetApp()`,
    and `store`, the app state as components use it (`store.setIsStaff(...)`)
  - `assignLoggedInCookie.ts` - sets the `LoggedIn` cookie the UI checks
  - `TestAppRouter.tsx` - the app in a memory router that follows its
    history; sign in first for a signed-in app
  - `msw.ts` - an `msw/node` server of the mock API (`src/msw/handlers.ts`),
    with the entries of `test/mocks/entries/entriesResponse.ts`
  - `storeFixtures.ts` - builders of tags, entries and junctions, and
    `seed()`, which stores them in the signed-in user's database
- Every jsdom test starts signed out, with no IndexedDB data and the mock
  API's data reset (`__tests__/setup.ts`); sign in with `signIn()` in a
  `beforeEach`.
- Prefer `screen.findBy*` over `waitFor(() => screen.getBy*)` for async
  elements
- Use `act()` for async renders: `await act(async () => render(<Component />))`
- E2E specs open pages with `BasePage.open()` (`test/pageobjects/base.ts`),
  which waits for MSW, sign in with `browser.login()`, and reset MSW in
  `afterEach` with `browser.resetMSWHandlers()`; the custom commands are in
  `test/wdio.shared.conf.ts`. Check the sign-in page before logging in, not
  after, and use `browser.waitUntil()` for async conditions.
