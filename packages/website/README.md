# Commandsnippets website

The public site (Astro, static HTML): the home page and the footer pages
(privacy, terms, contact, about — placeholders for now). Signing in happens in
the web app (`../frontend`); the website only links to it, per build mode
(`src/lib/appUrl.ts`):

| Mode | App |
|---|---|
| `production` | https://app.commandsnippets.com |
| `staging` | https://app-staging.commandsnippets.com |
| development | http://localhost:8085 |

```shell
bun install
bun run dev                 # http://localhost:4321
bun run build:staging       # or build:production; output in dist/
bun run lint && bun run check && bun run test
```

`bun run test` builds the staging and production sites into temporary
directories and checks the generated HTML, and tests the redirect Worker.

## Old app links

The web app used to be served on this host. `worker/index.ts` runs only when
no page matches and sends the request to the app (`APP_ORIGIN` in
`wrangler.jsonc`, which must match `appUrl` for the same mode), keeping the
path and query, so `/:user` and `/:user/:tag` bookmarks keep working. Paths
the website serves itself (`/privacy/`, `/terms/`, …) win.

## Deploying

```shell
bun run deploy:staging      # astro build --mode staging && wrangler deploy
bun run deploy:production
```
