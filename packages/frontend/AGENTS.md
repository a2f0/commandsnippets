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
  Components read one field with a selector
  (`useAppState(state => state.tagSortOrder)`), or the whole state with
  `useAppConfig()`: one object that stays the same across renders (a safe
  hook dependency) and reads the current state on every access, rendering
  again when a field it read changes (`useSyncExternalStore`, so a change
  before it subscribed counts too). Code outside React uses
  `useAppState.getState()`. `resetApplicationState()` signs out: every
  setting back to its default.
- **Signing out deletes the user's data**: the store deletes a user's
  IndexedDB database whenever `loggedInUser` leaves them, however it
  happens (the menu, the cookie gone, a session the API ended, another
  sign-in; `endSyncSession`).
- **The user's data**: `src/lib/db/database.ts`, a Dexie database per
  environment and user (`commandsnippets-<environment>-<username>`) of
  their tags, entries and junctions (deleted ones too) as api-shared's
  resources, and the sync's `cursors`. `src/lib/sync/session.ts` opens it for
  the signed-in user, with its sync; a session ends when another tab deletes
  or upgrades the database, and the next opens it anew.
- **What the UI shows**: `src/lib/data/hooks.ts`, live queries of the
  database (`dexie-react-hooks`: `useTags`, `useTagNamed`, `useTagEntries`,
  `useEntries('all' | 'untagged')`), so a list shows each change the moment
  a sync or a write stores it, in any tab; `src/lib/data/sort.ts` sorts and
  searches them (case-insensitively in any script, as the API's search).
  Deleted tags and entries are left out; untagged entries are those in no
  tag.
- **Writes**: `src/lib/data/writes.ts` first checks the API answers for the
  database's user (`SyncEngine.verifyOwner`), calls the API, then stores
  what it answered (`putResources`). A write answered with no body
  (untagging, deleting an entry, reordering) marks the row deleted unless a
  sync stored a newer revision meanwhile (`markDeleted`), and syncs the
  rest.
- **When the data syncs**: `src/lib/data/useSync.ts`. The entries page syncs
  the collection when it opens, when it comes back into view, and every half
  minute while in view (`useCollectionSync`); the tag shown syncs on its own
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
  resumes where one stopped; when the entries are read to the end, every tag
  gets a cursor of its own (`tag:<id>`: the newest junction revision when the
  sync began, and the tag's revision). `syncTag` reads one tag's junctions
  (`GET /tags_entries?filter[tag.id]=`, deleted ones too: entries that left
  it) after its cursor, from the start without one; a tag sync asked for
  while the collection syncs runs between two of its pages. A tag is synced
  while its cursor holds its revision (`isTagSynced`). Each sync first checks
  the API's user (`GET /user/`) is the database's, and refuses a page with
  another user's rows (a stale tab after someone else signed in).
- **What a sync stores**: `src/lib/sync/store.ts`: each resource unless the
  database holds a newer revision of it (revisions compare within a table);
  an entry stored decides its junctions (its `text_entry_to_tag` lists all
  of them not deleted, so the ones it leaves out are deleted), and an older
  copy of an entry leaves them alone; at the same revision, a deleted copy
  stays deleted (a delete stored without the API's revision).
- **Signing out when the session is gone**: `fetchWithAuth`
  (`src/lib/api/fetchWithAuth.ts`) calls `handleUnauthorized`
  (`src/lib/auth/authUtils.ts`) on a 401, and on a 403 whose first JSON:API
  error `code` (`src/lib/api/errorDocument.ts`) is `not_authenticated` or
  `authentication_failed` or that has no code; other 403s
  (`permission_denied`, `origin_not_allowed`) keep the session, and so does
  any OK response, whatever its body. `appState.ts` registers
  `resetApplicationState` as the handler. `authUtils` must not import the
  store: the store imports the sync, which imports the API client, so that
  would be an import cycle.

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
  401/403 responses and parses with api-shared's admin schemas; a response
  that breaks the contract is an `AdminApiError` with status 0.
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
  styles and the shared `sx` objects (`sx.ts`)
- **Non-UI code**: `src/lib/` (the API clients, auth, the app state
  (`state/`), the Dexie database (`db/`), its sync (`sync/`), what the UI
  reads and writes (`data/`), and helpers), `src/hooks/`, `src/providers/`,
  `src/i18n/` and `src/msw/`
- **Routes**: `src/Routes.tsx`; the first path segment is a username
  (`/:user/:tag`)
- **Libraries**: Material UI, Emotion (styled components), React Router,
  React DnD (reordering), i18next (`src/i18n/`)

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
  soft, and untagging keeps the junction for the junction list);
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
