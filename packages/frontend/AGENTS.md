# AGENTS.md

This file provides guidance to AI coding assistants when working with code in
this package. The repository-wide conventions (commits, branches, PRs, review
focus) are in the root `AGENTS.md`.

## Project Overview

The Command Snippets web client: a command snippet tool for programmers and
system administrators. Snippets (entries) are tagged, and both tags and
entries can be put in a user-defined order. The API is backend-v2
(`packages/backend-v2/`).

## Development Commands

The [README](README.md) holds the commands, run from `packages/frontend`:
[setup](README.md#setup), [code quality](README.md#code-quality) (`lint`,
`fix`, `compile`), [building](README.md#building),
[testing](README.md#testing) and [deploying](README.md#deploying). When you
change code:

- Typecheck with `bun run compile`, never a bare `tsc -b`, which can reuse
  stale output (the README's Code Quality says why).
- Run `bun run lint`, and `bun run fix` for what Biome can fix.
- Run the unit suite as CI does: `../../scripts/testing/runUnitTests.sh`,
  with spec paths to run some (`bun run unit -- --watch` fails: `unit`
  already passes `--no-watch`).
- Run E2E specs through `../../scripts/testing/runWebdriverTests.sh` (the
  suite, headless, as CI does) or `scripts/testing/runSpecHeadless.sh
  <spec-file>`; `bun run server-test` serves the app with the API mocked on
  <http://localhost:8081>.

## Architecture

[docs/architecture.md](docs/architecture.md) describes the package: the
[state](docs/architecture.md#state) (IndexedDB per user, synced with the API,
and the zustand app state), the [HUD's timings](docs/architecture.md#timings-the-hud),
[feature flags](docs/architecture.md#feature-flags), the
[API client](docs/architecture.md#api), the
[source layout](docs/architecture.md#source-layout),
[routing](docs/architecture.md#routing),
[rendering long lists](docs/architecture.md#rendering-long-lists),
[top-level routes](docs/architecture.md#top-level-routes) and the
[test setup](docs/architecture.md#testing-setup). Read the sections a change
touches before making it, and keep them current. The rules most changes meet:

- Gate a feature that is not on everywhere with a feature flag
  (`src/lib/featureFlags/flags.ts`), never an inline environment check
  (`environment !== 'production'`); to ship it everywhere, remove the flag
  and its checks.
- Take anything that crosses the wire from `@commandsnippets/api-shared`,
  never a hand-written type; import its smaller entries (`/responses`,
  `/messages`, types from `/requests`) and only `zod/mini`. Branch on error
  `CODES`, never on an error's detail.
- `src/lib/` never imports `components/`, `pages/`, `menu/` or `hooks/`, and
  the UI reaches IndexedDB only through `lib/data/`, never `lib/db/`;
  `lib/sync/` takes API errors from `lib/api/errors.ts`. No import cycles.
- Read the URL through `src/lib/router/` selectors that return a value
  (`useRoute(route => route.page)`, `useRouteParam`), selecting the least a
  component needs; handlers use `currentRoute()` and `navigate()`.
- Keep editor closing scoped to its mounted instance. A completed write may
  still need a data-related follow-up: a renamed selected tag follows its new
  URL only while the original route, session and account still apply. Close
  on successful persistence, not on the follow-up read's success. Test the
  selected-tag route, a cancelled/reopened draft's next save, and a failed
  follow-up read without reporting the stored write as unsaved.
  Capture the database account/version at Save and recheck inside the write
  transaction: a local row's blank user relationship is not its identity.
- Both form kinds share `lib/state/editorOwnership.ts` and
  `hooks/useEditorOwnership.ts`: open/focus/close events own keyboard mode;
  explicit list navigation releases it. Scope Tab to the owning form, not
  global active-field effects. Test both opening/closing orders, same-kind
  overlap, focus changes, and real list shortcuts after Save and Cancel.
- Keep list rows cheap: memoized rows with narrow selectors, stable
  callbacks, context menus rendered only while open, and row data from props
  rather than a live query per row.
- A new top-level route in `src/routePaths.ts` must also be a reserved
  username in the API ([reserved usernames](../backend-v2/README.md#access-and-auth)).
- Mocks follow the API contract: add a `contract.spec.ts` exchange for every
  new MSW route, and type mock documents with api-shared's types.
- A read or flow with several modes is a union on `status`, changed only by
  one pure `transition…(state, event)` tested by its table, with a request
  number so only the current read finishes (`useReuseHistory.ts`,
  `components/analytics/analyticsRead.ts`); derive booleans from it rather
  than holding `loading`/`failed` flags side by side.

## Documentation Maintenance

- When you find errors in the documentation (outdated commands, wrong
  descriptions) or places it could be clearer, update this `AGENTS.md` or
  [docs/architecture.md](docs/architecture.md), whichever holds it. Keep
  reference detail in `docs/` and this file within 18,500 characters.

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
- `bun run lint` enforces both (`lint:files`, ls-lint with the root
  `.ls-lint.yml`); specs take their subject's name, and the WebdriverIO
  module declarations in `test/` are kebab-case.

### Linting & Formatting

- Run `bun run lint` to check changes
- Use `bun run fix` (`biome check --write .`) to fix issues
- Never add linting or formatting exceptions in code
- Import each MUI icon from its own path
  (`import Check from '@mui/icons-material/Check'`): the package index loads
  every icon in the dev server and Vitest, and Biome refuses it
  (`noRestrictedImports`)

### Dependencies

- Follow [dependency maintenance](../../docs/dependencies.md): exact pins,
  `bun run agent-tool bun add <name>@<version> --exact --cwd packages/frontend`
  (or `bun update` / `bun remove` through `agent-tool bun`), and the root
  `bun.lock` committed with the manifest. A dependency whose install script
  it needs goes in the root `trustedDependencies` (README, Dependencies).
- `@commandsnippets/api-shared` is `workspace:*`, a link to `../api-shared`:
  its edits show at once; run `bun install` after changing its
  `package.json` (README, "The API contract").
- Vite treats the linked api-shared as source: it is not pre-bundled into
  `node_modules/.vite`, and the dev and test servers serve it from
  `../api-shared`. `server.fs.allow` in `vite.config.ts` admits only this
  package, `../api-shared`, the workspace's package store and the brand
  sources, never the whole workspace, and `server.fs.deny` refuses
  `.dev.vars` and `.secrets` wherever a path reaches them
  (`__tests__/infra/devServer.spec.ts`).

### TypeScript

- Always run `bun run compile` after making changes to ensure TypeScript
  compiles (not a bare `tsc -b`, which can reuse stale output; see the
  README's Code Quality)
- Never use `any` as a type, or `as` for type assertion
- **Use invariant for strict null checks**: When working with potentially null
  DOM elements or values that should exist but may be null according to
  TypeScript, use the `invariant` library for runtime assertions:

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

- This approach provides better error messages and satisfies TypeScript's strict
  null checks without unsafe type assertions

### Package Manager

- Always use `bun` for the JavaScript package manager

### Language

- Always write code in TypeScript, never JavaScript

### Console Output & Logging

- **Never use colored emojis** (🚀🔨📱✅❌⚠️🔍📁🧪📊🔄) in console output, error messages,
  or logging
- Use clear ASCII text prefixes instead: `OK:`, `ERROR:`, `WARNING:`,
  `SUCCESS:`, `PASS:`, `FAIL:`
- Unicode characters for expression are acceptable (e.g., →, ×, ✓ as text), but
  avoid colorful emoji characters
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
  (`../../scripts/testing/runUnitTests.sh`): some unit specs import those mocks.
- Unit tests are Vitest specs in `__tests__/`. Helpers in `__tests__/util/`:
  - `signIn.ts` - `signIn()` (as the mock API's user, `test`), `resetApp()`,
    and `store`, the app state as components use it (`store.setIsStaff(...)`)
  - `assignLoggedInCookie.ts` - sets the `LoggedIn` cookie the UI checks
  - `TestAppRouter.tsx` - `renderAppAt(route)`, the app in a memory router
    that follows its history; sign in first for a signed-in app
  - `msw.ts` - an `msw/node` server of the mock API (`src/msw/handlers.ts`),
    with the entries of `test/mocks/entries/entriesResponse.ts`: a spec
    serves it with `serveMockApi()` (never a server of its own), overrides a
    route with `server.use`, and records what it sends with
    `recordRequests(pick)`
  - `documents.ts` - request documents and headers specs send the mock API
    themselves (`JSON_API`, `tagEntryDocument`, `reorderDocument`)
  - `storeFixtures.ts` - builders of tags, entries and junctions, and
    `seed()`, which stores them in the signed-in user's database; `own()`
    and `rowKey()` make a resource a row and key a row as the database does
  - `apiClientMethods.ts` - the API client's methods, shared by every client
    (`apiClient` and `apiClient.writesAs`'s): spy on these to see a call
    whichever client makes it
  - `environment.ts` - `stubEnvironment(name)`, the app's environment for
    the rest of the test (read at call time; values derived at load stay)
  - `restoreElsewhere.ts` - another device's restore against the mock API
    (over the active data version), making a new version active
- Every jsdom test starts signed out, with no IndexedDB data and the mock
  API's data reset (`__tests__/setup.ts`); sign in with `signIn()` in a
  `beforeEach`.
- Prefer `screen.findBy*` over `waitFor(() => screen.getBy*)` for async
  elements
- Use `act()` for async renders: `await act(async () => render(<Component />))`
- E2E specs open a page signed in with `BasePage.signIn(path, {entries})`
  (`test/pageobjects/base.ts`: it loads the sign-in page signed out, logs in,
  then opens `path`; `entries` replaces the mock API's entries), or a page as
  it is with `BasePage.open()`, which waits for MSW. The harness
  (`test/wdio.shared.conf.ts`, with the custom commands) resets MSW and
  `browser.currentTestErrors` after every test, so specs need no
  `afterEach` for it. `browser.toBeRequestedTimes` and
  `toBeRequestedAtLeastTimes` wait for the count (a page makes its requests
  as it syncs). Use `browser.waitUntil()` for other async conditions.
