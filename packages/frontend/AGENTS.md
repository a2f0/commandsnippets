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
- `bun run compile` - TypeScript check (`tsc -b`). If it reports errors from
  stale output after a type changes, delete `.ts-out` and rerun.

### Testing

#### Unit Tests (Vitest)
- `../../scripts/runUnitTests.sh` - Run all unit tests, as CI does (it disables
  Node's experimental Web Storage, which would replace jsdom's `localStorage`)
- `../../scripts/runUnitTests.sh __tests__/reorderEntryList.spec.tsx` - Run
  specific files
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
- **Store**: one MobX-State-Tree instance, `src/lib/store/store.ts`, of
  `src/lib/store/models/RootModel.ts` (with `TagModel`, `TextEntryModel`,
  `TagTextEntryThroughModel` and `UserModel` beside it). It is created
  synchronously when `store.ts` is first imported: the saved snapshot in
  `localStorage` (`mst-tearleads-<environment>`) merged over `defaultState`
  (`src/lib/shared.ts`). Every change is saved back to `localStorage`.
- **No migrations**: if a saved snapshot no longer fits the model, the store
  falls back to `defaultState` (a try/catch around `applySnapshot`). New model
  fields must be optional or have defaults so older snapshots still load.
- **Context**: `src/AppContext.tsx` provides the store; components read it
  with `useAppContext()`.
- **Signing out on a 403**: `fetchWithAuth` (`src/lib/api/fetchWithAuth.ts`)
  calls `handleUnauthorized` (`src/lib/auth/authUtils.ts`) on a 403, and
  `store.ts` registers `resetApplicationState` as its handler. `authUtils`
  must not import the store: the models import the API client, so that would
  be an import cycle.

### API
- `src/lib/api/tearleadsApi.ts` - the JSON:API client for tags, entries and
  auth. Every request sends the auth cookie (`credentials: 'include'`).
- `src/lib/api/adminApi.ts` - the staff-only admin API, which handles its own
  401/403 responses.
- `src/lib/api/baseUrl.ts` - the API URL for the environment, which
  `src/lib/environment.ts` derives from the page's hostname and port.
- `src/lib/tags.ts` and `src/lib/text_entries.ts` - paging fetches and the
  client-side sorting and filtering of tags and entries.

### Local Database (Debug only)
- `src/lib/db/` wraps a Dexie (IndexedDB) database that only the Debug menu's
  "Populate IndexedDB" item writes to. The app does not read from it. There is
  no Turso/SQLite adapter any more.

### UI
- **Entry and tag lists**: `src/EntryList.tsx`, `src/Entry.tsx`,
  `src/TagList.tsx`, `src/Tag.tsx`, with their context menus and editors in
  `src/`
- **Menu bar**: `src/MenuBar.tsx`; each menu is in `src/menu/<name>/`, and
  `src/menu/StyledMenu.tsx` is their shared drop-down
- **Drag and drop**: React DnD, with `src/DragHandle.tsx` and
  `src/DragHandleContainer.tsx`, for reordering
- **Routes**: `src/Routes.tsx`; the first path segment is a username
  (`/:user/:tag`)
- **Libraries**: Material UI, Emotion (styled components), React Router,
  i18next (`src/i18n/`)

### Top-level routes
- Every top-level route in `src/routePaths.ts` must also be a reserved username
  in backend-v2 `src/services/reserved-usernames.json` (usernames are the first
  path segment); `__tests__/src/routePaths.spec.ts` checks this

### Testing Setup
- **Mock Service Worker (MSW)**: `src/msw/` mocks the API in the browser. Only
  test mode (`bun run server-test`) starts it, from `src/index.tsx`; see
  `src/msw/README.md`. The service worker is `public/mockServiceWorker.js`.
- **Vitest**: specs in `__tests__/`, in jsdom. `__tests__/setup.ts` loads the
  jest-dom matchers and stubs `scrollIntoView`; `vite.config.ts` also loads
  `fake-indexeddb/auto`. Unit specs mock the API with `msw/node`
  (`__tests__/util/msw.ts`). `__tests__/hosting.spec.ts` builds the app and
  serves it with `wrangler dev`.
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
- Name new directories in camelCase too. Some existing names are snake_case
  (`text_entries.ts`, `admin_page/`, `menu_items/`); don't copy them.

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

### TypeScript
- Always use `bun run compile` (or `bunx tsc -b`) after making changes to ensure TypeScript compiles
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
  - `LoggedInAppContextProvider.tsx` - provides a store with a signed-in user
  - `loggedInStore.ts` - that store
  - `assignLoggedInCookie.ts` - sets the `LoggedIn` cookie the UI checks
  - `TestAppRouter.tsx` - the app in a memory router, signed in
  - `msw.ts` - an `msw/node` server with the default API responses
- Prefer `screen.findBy*` over `waitFor(() => screen.getBy*)` for async
  elements
- Use `act()` for async renders: `await act(async () => render(<Component />))`
- Reset the store between tests (`applySnapshot(store, defaultState)`) when a
  test changes it
- E2E specs open pages with `BasePage.open()` (`test/pageobjects/base.ts`),
  which waits for MSW, sign in with `browser.login()`, and reset MSW in
  `afterEach` with `browser.resetMSWHandlers()`; the custom commands are in
  `test/wdio.shared.conf.ts`. Check the sign-in page before logging in, not
  after, and use `browser.waitUntil()` for async conditions.
