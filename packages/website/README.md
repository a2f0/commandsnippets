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
the website serves itself (`/privacy/`, `/terms/`, …) win. The
`assets_navigation_has_no_effect` flag keeps browser navigations (bookmarks)
on that path too; `test/routing.test.ts` checks the whole routing through
`wrangler dev`, with and without `Sec-Fetch-Mode: navigate`.

The app also installed a service worker here (`/sw.js`), which browsers keep
and which can serve the old app, with its old OAuth redirect URIs, from its
caches. `public/sw.js` replaces it: browsers pick it up on their next update
check, and it empties the caches, unregisters itself and reloads open pages.
Keep serving it; a redirect or 404 for `/sw.js` leaves the old worker in place.

## Deploying

```shell
bun run deploy:staging      # astro build --mode staging && wrangler deploy
bun run deploy:production
```

Hostnames are custom domains in `wrangler.jsonc`, attached by the deploy:
`website-staging.commandsnippets.com` for staging and the apex
`commandsnippets.com` for production (`www` redirects to it, from
`terraform/stacks/zone`).
