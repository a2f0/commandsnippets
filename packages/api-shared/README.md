# @commandsnippets/api-shared

The Commandsnippets API contract, as [zod](https://zod.dev) schemas: every
request document, query, response document and error the API
(`../backend-v2`) speaks, with the exact error messages it sends and the
TypeScript types inferred from them. The API validates its input with these
schemas, and clients can parse its responses with them.

It is TypeScript source with no build step, which each consumer compiles
with its own code. The schemas are built with
[`zod/mini`](https://zod.dev/packages/mini), zod's tree-shakable functional
API (see [zod/mini](#zodmini)).

## Entry points

`package.json` exports six entries, and declares `"sideEffects": false`, so
a bundler drops any module whose exports go unused:

| Import | What | Who |
|---|---|---|
| `@commandsnippets/api-shared` | all of it | the API |
| `@commandsnippets/api-shared/responses` | response documents, resources and error documents: schemas and types; resource type names | clients, to parse |
| `@commandsnippets/api-shared/requests` | request documents, fields, filters and collection queries: schemas, messages and types | the API; clients, for types |
| `@commandsnippets/api-shared/messages` | `CODES` and `MESSAGES` | anyone |
| `@commandsnippets/api-shared/datetime` | the timestamp format and `parseDateTime` (no imports; see below) | the backend's Bun scripts |
| `@commandsnippets/api-shared/cursor` | keyset cursors: `CURSOR_START`, `cursorOf`, `parseCursor` (no zod; also in `./responses` and `./requests`) | clients, to page |

`./responses` loads none of the request-side modules (`test/entries.test.ts`
checks), so a client that parses responses bundles only the response schemas.
A client that sends requests needs only their types (`import type` from
`./requests`), which compile away.

The schema factories (`charField`, `createDocumentSchema`, `listQuerySchema`,
...) are marked `// @__NO_SIDE_EFFECTS__`, as zod marks its own, so a bundler
can drop a schema a module builds that nothing uses. Importing a constant
such as `TEXT_ENTRY_SORT_FIELDS` from `./requests` then bundles the constant,
not the request validators beside it.

## Layout

| Path | What |
|---|---|
| `src/index.ts`, `src/responses.ts`, `src/requests.ts` | the entry points (above): re-exports |
| `src/messages.ts` | `MESSAGES` and `CODES`: the DRF-style error texts and codes, byte for byte |
| `src/issues.ts` | how a schema failure carries an API error (`fail`, `errorMeta`) |
| `src/fields.ts` | DRF serializer fields: `charField`, `booleanField`, `pkField`, `relatedField` |
| `src/filters.ts` | `filter[...]` value schemas (`integerFilter`, `dateTimeFilter`, ...) |
| `src/query.ts` | `listQuerySchema`: a collection's `filter`, `sort`, `page`, `include`, `filter[search]`; `ListParams`, the same as a client sends them |
| `src/include.ts` | `include` paths over a relationship graph (`IncludePath`: every path, as a type) |
| `src/datetime.ts` | the timestamp format and `parseDateTime` |
| `src/cursor.ts` | keyset cursors (`page[after]`): `<date_updated>,<id>` |
| `src/jsonapi/request.ts` | request envelopes and create/update document schemas |
| `src/jsonapi/response.ts` | resource, document, list-document (numbered and keyset pages) and error-document schemas |
| `src/resources/types.ts` | resource type names, `RELATIONSHIPS`, `DEFAULT_INCLUDES` |
| `src/resources/*.ts` | per resource: the resource as the API renders it (response schemas and types) |
| `src/resources/documents.ts` | each endpoint's response documents |
| `src/resources/requests/*.ts` | per resource: request documents, the collection's query (and its `...ListParams`), and their types |
| `test/` | `bun test` unit tests |

Schemas are named `...Schema` (`tagSchema`, `tagListQuerySchema`); their
output types drop the suffix (`Tag`, `TagListQuery`).

## How errors work

Every request-side failure is a zod `custom` issue: its `message` is the error
`detail`, and its `params` (`ErrorMeta`: `code`, and `status` and `pointer`
where they differ from 400 and the field's own) are the rest of the JSON:API
error object. `errorMeta(issue)` reads them. The backend's adapter
(`src/lib/validate.ts` there) turns issues into errors with DRF's two
behaviors:

- **Documents and queries fail at their first error**, in the order DRF
  checked them (see the comments in `jsonapi/request.ts` and `query.ts`): use
  the first issue.
- **Fields report every failing field**, one error each, in field order (the
  object schema's key order): use all issues. `z.partial()` makes every field
  optional (PATCH).

Lookups are own-property only: `constructor` or `toString` is no one's
filter, sort field or relationship.

## Using it

A consumer depends on the package by path, and provides zod itself (it is a
peer dependency):

```json
"dependencies": {
  "@commandsnippets/api-shared": "file:../api-shared",
  "zod": "^4.6.5"
}
```

Bun installs a `file:` dependency as a tree of per-file symlinks into
`../api-shared` (with the isolated linker, the web app's, as hard links into
its `node_modules/.bun/` store), and installs its devDependencies alongside.
Either way, `import 'zod'` in api-shared's sources resolves from where they
are, not from the consumer: tools that follow symlinks, which is all of them,
load them from `../api-shared`, whose own development copy of zod may differ
(and is missing in CI, where only the consumer is installed), and hard links
sit in the store next to the zod its devDependencies brought in. So each
consumer points `zod` at its own copy:

- TypeScript (`tsconfig.json`, or the web app's `tsconfig-base.json`):
  `"paths": {"zod": ["./node_modules/zod"], "zod/*": ["./node_modules/zod/*"]}`
  (the second covers `zod/mini`)
- Vite and Vitest: `resolve: {dedupe: ['zod']}` (subpaths included)
- Wrangler, where it bundles the code (backend-v2's `wrangler.jsonc`): an
  `alias` per import, since it matches them exactly:
  `{"zod": "./node_modules/zod/index.js", "zod/mini": "./node_modules/zod/mini/index.js"}`

The consumers are the API (`packages/backend-v2`), which validates its input
with the schemas (it imports the root entry), and the web app
(`packages/frontend`), which types its requests with them and parses the
responses (its `src/lib/api/` imports `./responses`, `./messages`, and types
from `./requests`).

Code that runs outside a bundler (the backend's Bun scripts) can only load
modules without imports: `@commandsnippets/api-shared/datetime` is one, and
must stay one (a test checks).

**After changing api-shared, run `bun install` in each consumer**
(`packages/backend-v2`, `packages/frontend`) when you add, move or remove a
file or change `package.json`: edits to existing files show through the links
at once, but the tree of links is only rebuilt by an install. In the web app,
also reinstall after an edit if your editor saves by replacing the file: its
hard link keeps the old one. Commit a consumer's `bun.lock` if the install
changes it. The pre-push hook and CI reinstall and check `backend-v2` whenever
`packages/api-shared/` changes, and CI runs the web app's checks as well.

### Clients

Parse a response with its endpoint's document schema, and narrow `included`
by `type`:

```ts
import {tagListDocumentSchema} from '@commandsnippets/api-shared/responses';

const page = tagListDocumentSchema.parse(await response.json());
const users = page.included?.filter(resource => resource.type === 'User');
```

Type a request with its document type (the schemas' output), and a
collection's query with its `...ListParams` type:

```ts
import type {
  TagCreateDocument,
  TextEntryListParams,
} from '@commandsnippets/api-shared/requests';

const body: TagCreateDocument = {data: {type: 'Tag', attributes: {name}}};
const query: TextEntryListParams = {
  'page[number]': 1,
  'filter[user.username]': username,
  'filter[tag_count]': 0,
  sort: '-date_created',
  include: 'text_entry_to_tag.tag,user',
};
```

Each collection has one (`TagListParams`, `TextEntryListParams`,
`TagTextEntryListParams`, `TextEntryReusedListParams`,
`AdminUserListParams`, `AdminAuditLogListParams`), derived by `ListParams`
from the spec its query schema is built from, so the two cannot drift:
`filter[...]` for each filter (named with `.`), its value the type the filter
parses it into (`number` for `filter[tag_count]`); `sort`, a comma-separated
list of `SortKey`s (`field` or `-field`); `page[number]` and `page[size]`;
`page[after]` where the collection pages by revision; `filter[search]` where
the collection searches; and `include`, a list of `IncludePath`s, where it
resolves includes. What the API would refuse does not type-check. The lists
type-check up to three items (`CommaList`); the API takes more. Send the
object as `URLSearchParams`, the values as `String()` writes them
(`test/params.test.ts` checks that every parameter a type allows, the schema
accepts).

Tags, entries and junctions also page by revision (`date_updated`, then
`id`): `page[after]=<cursor>` lists the rows past a cursor, oldest first,
uncounted, with `links.next` while rows are left (`tagCursorListDocumentSchema`
and its siblings parse them). Start from `CURSOR_START` and page from each
page's last row (`cursorOf(row)`): a row that changes meanwhile moves past
the cursor and a later page lists it, so a sync that reads until `next` is
null has every change since it started, and keeps the last cursor to resume
from. `page[after]` takes no `page[number]` or `sort`.

Error responses parse with `errorDocumentSchema`; branch on `CODES`
(`@commandsnippets/api-shared/messages`, `CODES.permissionDenied`) rather
than on messages.

The web app does all three: `apiClient.ts` types its request bodies with the
document types and parses every response it returns with its endpoint's
document schema, failing the call on one that does not fit;
`errorDocument.ts` reads the first error's `code` and `detail` with
`errorObjectSchema`'s fields, for the sign-out rule and the admin page. Its
MSW mocks are checked against these schemas too
(`__tests__/src/msw/contract.spec.ts` there).

### zod/mini

The schemas are `zod/mini` schemas (`z.ZodMiniType`), whose functional API
bundlers can tree-shake: a client bundles only the zod it uses. Classic zod
puts every method on every schema, so importing it at all bundles nearly all
of it. In the web app's production bundle, zod/mini and the response schemas
come to about 34 kB (11 kB gzipped), where classic zod and all the schemas
took about 102 kB (30 kB gzipped).

For a consumer, that means:

- **Write zod/mini:** `z.optional(schema)`, `z.pipe(a, z.transform(fn))`,
  `schema.check(z.refine(fn))` rather than `.optional()`, `.transform()` and
  `.refine()`. `parse`, `safeParse`, `.shape` and `z.output` work as before.
  Type a schema parameter as `z.ZodMiniType` (`import type * as z from
  'zod/mini'`): a zod/mini schema is not a classic `z.ZodType`.
- **Keep classic `zod` out of client code:** one runtime import of it brings
  back everything zod/mini leaves out (the web app has a test for this).
- **Load a locale:** zod/mini loads none, so zod's own messages (a response
  field of the wrong type, say) all read `Invalid input`. Both consumers load
  English once, which keeps them as classic zod wrote them
  (`Invalid input: expected string, received number`):

  ```ts
  import {en} from 'zod/locales';
  import * as z from 'zod/mini';

  z.config(en());
  ```

  The API's own errors do not depend on it: every request-side failure
  carries its message (below).

## Adding a schema

1. Put it with its resource (or next to the generic helpers, if it is one),
   built from the helpers: responses in `src/resources/`
   (`resourceSchema`/`relatedResourceSchema`, and `documentSchema`/
   `listDocumentSchema` in `documents.ts`); requests in
   `src/resources/requests/` (`charField` and friends for fields,
   `createDocumentSchema`/`updateDocumentSchema` for documents,
   `listQuerySchema` for a collection's query: write its spec as an
   `as const` object, build the schema from it, and export
   `ListParams<typeof spec, IncludePath<...>>` beside it). A response
   module must not import a request-side one: clients bundle `./responses`
   alone. A new relationship goes in `RELATIONSHIPS` (and
   `DEFAULT_INCLUDES`).
2. Any new error text goes in `MESSAGES` (and a new code in `CODES`), worded
   exactly as the API sends it. Report failures with `fail(ctx, message, meta)`
   in a `z.transform`, or `z.refine(fn, check(message, code))`, never zod's
   default messages.
3. Export the schema and its `z.output` type. A new module goes in
   `src/responses.ts` or `src/requests.ts`, which re-export each module (the
   root entry re-exports both). Mark a new schema factory (a function named
   `...Schema` or `...Field`) `// @__NO_SIDE_EFFECTS__`; a test checks.
4. Test it in `test/`, and in the backend: validate with it there, and cover
   its responses in `test/contract/`.
5. Run `bun install` in `packages/backend-v2` if you added a file (see above).

Keep the source strictest-clean (`@tsconfig/strictest`, `verbatimModuleSyntax`)
and free of runtime-specific APIs (no DOM, Node or Bun globals): consumers
compile it under their own settings, including the web app's. `tsconfig.json`
spells out strictest's options instead of extending the package, because
consumers' bundlers (Vite, esbuild) read it for these sources, and where only
the consumer is installed the package is not there; a test keeps the copy in
step.

## Development

```shell
bun install
bun run lint
bun run typecheck   # src/ with no ambient types, then src/ and test/ with Bun's
bun run test        # bun test, with a 98% line and function coverage gate
```
