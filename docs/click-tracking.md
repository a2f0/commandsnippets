# Click tracking

The website and browser app explicitly initialize `@a2f0/ct-client` in their
browser bootstraps. Importing either integration does not start collection.
Only a production build in `production` or `staging` mode can initialize, and
the current origin must exactly match that mode's deployed origin.

| Origin | App | Environment |
| --- | --- | --- |
| `commandsnippets.com` | `website` | `production` |
| `app.commandsnippets.com` | `web-app` | `production` |
| `website-staging.commandsnippets.com` | `website` | `staging` |
| `app-staging.commandsnippets.com` | `web-app` | `staging` |

All use site `commandsnippets`. `www` redirects to the apex before collection.
The SDK queues trusted clicks and flushes batches to `https://ct.a2f0.net`.
It records element types, not their text, attributes or link destinations.
Inputs, textareas, selects, editable content and `data-ct-ignore` subtrees are
excluded. Web app events always use page `/`: usernames and tag names in its
routes must never be collected. The website uses a finite list of public pages,
with unknown paths reduced to `/`; query strings and fragments are omitted.

These integrations set `overrideGpc: true`, so Global Privacy Control does not
disable collection. Do Not Track, the CT extension, the local CT opt-out and
the SDK's automation guard remain effective. Development, test and preview
origins do not initialize. Tests must intercept CT requests rather than send
events to the live collector.

CT is operated by Tearleads, LLC and hosted on Cloudflare. The collector stores
the request IP and available approximate geography (country, region and city)
with click records, retained for up to 90 days. The dashboard and data API
require an authenticated CT administrator. There are no account or persistent
visitor identifiers in browser event payloads. The website's privacy page
discloses this collection and its browser-preference behavior.
The app links to that notice on its sign-in page and in Help > About, including
for visitors viewing shared public snippets.

Deploy the website and frontend independently to both environments using each
package's documented commands. Register any new origin in CT before deploying
an integration. CT operations and extension opt-out instructions live in the
[CT repository](https://github.com/a2f0/ct).
