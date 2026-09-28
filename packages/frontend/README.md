# Commandsnippets Frontend

A command snippet tool for computer programmers and system administrators. It's
a tagging system that allows for user-defined ordering of both Tag and Entry
objects, using MobX-State-Tree for the app's state, saved in `localStorage`.

## Development

### Prerequisites

- [Bun](https://bun.com) installs dependencies and runs the scripts.
- Node.js, at the version in `.nvmrc`: Vite, Vitest, WebdriverIO and wrangler
  run on it.

### Setup

```shell
# Install dependencies
bun install

# Start development server
bun run dev
```

The git hooks are the repository's (`scripts/git/hooks`); install them from
the repository root with `bun install && bun run hooks:install`.

### Dependencies

`bun install` reads `bun.lock` and `bunfig.toml`:

- **Install layout:** an isolated `node_modules`, so code can import only the
  packages it declares.
- **New releases:** versions published less than a day ago are not installed.
- **Install scripts:** only the packages in `trustedDependencies` run theirs
  (the WebDriver and ffmpeg binaries, esbuild, workerd). This list replaces
  Bun's default allowlist.
  - `msw`'s would rewrite `public/mockServiceWorker.js`; regenerate that with
    `bunx msw init public` after upgrading msw.
- **`overrides`:** these pin fixed versions of indirect dependencies that
  `bun audit` flags:
  - `@puppeteer/browsers` 3.x drops `extract-zip`, which has path-traversal
    advisories (GHSA-jmr9-qjv8-65gv, GHSA-7pqw-9j4j-h8q3).
  - `serialize-javascript` 7.0.5 or later fixes GHSA-5c6j-r48x-rmvq and
    GHSA-qj8w-gfj5-8c6v.
  - Drop an override once `bun audit` passes without it.

### The API contract

`@commandsnippets/api-shared` (`../api-shared`, a `file:` dependency) is the
API's contract as [zod](https://zod.dev) schemas. The API client types its
requests with it and parses every response it returns with it: a response
that does not fit fails the call, and never reaches the app's state or signs
anyone out (AGENTS.md, "API"). It is TypeScript source, which this package
compiles and bundles with its own code:

- **Import the smaller entries:** `src/lib/api/` imports the response
  schemas from `@commandsnippets/api-shared/responses`, `CODES` from
  `/messages`, and only types from `/requests`, so the request-side schemas
  (the API's validation) stay out of the bundle. Type-only imports from the
  root entry compile away and are fine anywhere.
- **One zod:** zod is api-shared's peer dependency, and its sources'
  `import 'zod'` resolves from where they are installed.
  `tsconfig-base.json`'s `paths` and Vite's `resolve.dedupe` (which Vitest
  shares) point it at this package's `zod`, so there is one copy, for the
  types and in the bundle.
- **Reinstall after changing it:** the install hard-links api-shared's files
  into `node_modules/.bun/`. Run `bun install` here after adding, moving or
  removing a file there or changing its `package.json`, or after editing one
  with an editor that saves by replacing the file (the old one stays linked),
  and commit `bun.lock` if it changes. CI runs this package's checks whenever
  `packages/api-shared/` changes.
- **Size:** zod and the schemas add about 30 kB, gzipped, to the production
  bundle (most of it zod).

## Code Quality

Check linting and formatting (`bun run fix` fixes what it can):

```shell
bun run lint
bun run format
```

Run TypeScript compilation check:

```shell
bun run compile
```

## Deploying

The app is a static single-page app served by a Cloudflare Worker (assets only;
`wrangler.jsonc`): files from `build/`, and `index.html` for any other path, so
client routes like `/:user/:tag` work. `public/_headers` adds security headers
and long-lived caching for the fingerprinted `/assets/`.

```shell
bun run deploy:staging      # vite build --mode staging, then wrangler deploy
bun run deploy:production
```

Each environment's hostname is a custom domain in `wrangler.jsonc`, attached
by the deploy: `app-staging.commandsnippets.com` for staging and
`app.commandsnippets.com` for production. The app picks its
environment (API and OAuth callbacks) from that hostname, so it does not run
on workers.dev.

## Routes and the admin page

The first path segment is a username (`/:user/:tag`), so the app's own
top-level routes (`src/routePaths.ts`: `/admin`, `/oauth/...`) are reserved
usernames in the API (backend-v2 `src/services/reserved-usernames.json`).
`__tests__/src/routePaths.spec.ts` fails if a route is missing there; add a
new top-level route to both.

`/admin` is for staff (`users.is_staff`): it lists accounts, deactivates and
reactivates them, and shows the audit log, through the API's `/api/v1/admin`.
The page checks access with the API on every visit, and the menu shows an
Admin link to staff once their login or a visit to the page has recorded it.
Its menu bar leaves out what only works on the entries page (the Tags and
Entries menus, New Tag and New Entry) and links back to your entries instead.

## Testing

### E2E Tests

Start the server and run tests in a single command (Chrome only;
`../../scripts/runWebdriverTests.sh` runs the headless suite as CI does):

```shell
bun run ci
bun run ci-headless
```

Start the testing server (on different port than normal development server), and then run tests manually in a separate command:

```shell
bun run server-test
# in a different console tab
bun run test
bun run test-headless
```

Run a specific spec:

```shell
bun run server-test
bun run test -- --spec=test/specs/entries/entriesContextMenu/listsEntries.spec.ts
```

or

```shell
./scripts/runSpec.sh test/specs/tags/tagContextMenu/allowsDeletingATag.spec.ts
```

### Unit Tests

Run unit tests (the script disables Node's experimental Web Storage, which
would replace jsdom's `localStorage`):

```shell
../../scripts/runUnitTests.sh
../../scripts/runUnitTests.sh __tests__/integration/reorderEntryList.spec.tsx
```

For watch mode, run `NODE_OPTIONS=--no-experimental-webstorage bunx vitest`
in a terminal.
