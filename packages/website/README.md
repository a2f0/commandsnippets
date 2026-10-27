# Command Snippets website

The public site (Astro, static HTML): the home page (what the app does, with
an HTML sketch of it: `src/components/AppPreview.astro`), the about page, and
the privacy policy, terms of service and contact page. This package is
available on the web at <https://commandsnippets.com>. Tearleads, LLC is
the operator; support@tearleads.com handles support and privacy requests.
Its copy states only what the app does today.
Signing in happens in the web app (`../frontend`); the website only links to it,
per build mode
(`src/lib/appUrl.ts`):

| Mode         | App                                     |
| ------------ | --------------------------------------- |
| `production` | https://app.commandsnippets.com         |
| `staging`    | https://app-staging.commandsnippets.com |
| development  | http://localhost:8085                   |

```shell
bun install
bun run dev                 # http://localhost:4321
bun run build:staging       # or build:production; output in dist/
bun run lint && bun run check && bun run test
```

`bun run test` builds the staging and production sites into temporary
directories and checks the generated HTML, and tests the redirect Worker.

`bun run images` renders the favicons, Apple touch icon and link-preview
image (`og-image.png`, 1200×630) into `public/` from the repository's brand
sources (`../../assets/brand/`), using the pinned agent-tool and the
`favicons` and `social` targets in `../../agent-tool.json`. The
dev, build and test scripts run it first, so it needs the repository root's
`bun install`; the outputs are gitignored.

Deployed pages use CT for click analytics. See
[click tracking](../../docs/click-tracking.md) for environments, privacy behavior
and test isolation.

## Search engines

Only the production build may be indexed (`src/lib/site.ts`). Every page has
its description and Open Graph tags, including the preview image at the
build's own host (`og:image`, shown as Twitter's large card). Production pages
with content also name their canonical URL (and `og:url`), and the home page
has JSON-LD; staging pages name no page URL. The build writes the files that
differ by mode (`astro.config.mjs`): production gets `robots.txt` naming
`sitemap.xml`, which lists the canonical URL of every built page that names
one; staging gets a `robots.txt` without a sitemap (crawling stays allowed,
so crawlers see the noindex), a robots `noindex` meta on every page, and a
`_headers` that sends `X-Robots-Tag: noindex, nofollow` with every file. The
Worker's own responses get that header from staging's `X_ROBOTS_TAG` var.

All current pages have content and may be indexed in production, including
privacy, terms and contact. The legal pages share `src/layouts/Legal.astro`
for their individual revision dates and section navigation. Keep their disclosures in
sync with authentication, storage, sharing, deletion and analytics behavior;
update their date when policy content changes. `test/site.test.ts` checks
published page metadata, section links and the sitemap. Any future placeholder
can use `Placeholder.astro`, which passes `placeholder` to `Base.astro` to stay
out of search until published.

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
