# @commandsnippets/api-shared

The Commandsnippets API contract, as [zod](https://zod.dev) schemas: every
request document, query, response document and error the API
(`../backend-v2`) speaks, with the exact error messages it sends and the
TypeScript types inferred from them. The API validates its input with these
schemas, and clients can parse its responses with them.

It is TypeScript source with no build step: `package.json` exports
`./src/index.ts` (and `./src/datetime.ts` as `./datetime`), and each consumer
compiles it with its own code.

## Layout

| Path | What |
|---|---|
| `src/messages.ts` | `MESSAGES` and `CODES`: the DRF-style error texts and codes, byte for byte |
| `src/issues.ts` | how a schema failure carries an API error (`fail`, `errorMeta`) |
| `src/fields.ts` | DRF serializer fields: `charField`, `booleanField`, `pkField`, `relatedField` |
| `src/filters.ts` | `filter[...]` value schemas (`integerFilter`, `dateTimeFilter`, ...) |
| `src/query.ts` | `listQuerySchema`: a collection's `filter`, `sort`, `page`, `include`, `filter[search]` |
| `src/include.ts` | `include` paths over a relationship graph |
| `src/datetime.ts` | the timestamp format and `parseDateTime` (no imports; see below) |
| `src/jsonapi/request.ts` | request envelopes and create/update document schemas |
| `src/jsonapi/response.ts` | resource, document, list-document and error-document schemas |
| `src/resources/types.ts` | resource type names, `RELATIONSHIPS`, `DEFAULT_INCLUDES` |
| `src/resources/*.ts` | per resource: response, request and query schemas, and their types |
| `src/resources/documents.ts` | each endpoint's response documents |
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
  object schema's key order): use all issues. `.partial()` makes every field
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
`../api-shared` (and installs its devDependencies alongside). Tools that follow
symlinks, which is all of them, then load the sources from `../api-shared`,
where `import 'zod'` would find api-shared's own development copy, or nothing
in CI, where only the consumer is installed. So each consumer points `zod` at
its own copy:

- TypeScript (`tsconfig.json`):
  `"paths": {"zod": ["./node_modules/zod"], "zod/*": ["./node_modules/zod/*"]}`
- Vite and Vitest: `resolve: {dedupe: ['zod']}`
- Wrangler (`wrangler.jsonc`): `"alias": {"zod": "./node_modules/zod/index.js"}`

Code that runs outside a bundler (the backend's Bun scripts) can only load
modules without imports: `@commandsnippets/api-shared/datetime` is one, and
must stay one (a test checks).

**After changing api-shared, run `bun install` in each consumer**
(`packages/backend-v2`) when you add, move or remove a file or change
`package.json`: edits to existing files show through the symlinks at once, but
the symlink tree is only rebuilt by an install. Commit a consumer's `bun.lock`
if the install changes it. The pre-push hook and CI reinstall and check
`backend-v2` whenever `packages/api-shared/` changes.

### Clients

Parse a response with its endpoint's document schema, and narrow `included`
by `type`:

```ts
import {tagListDocumentSchema} from '@commandsnippets/api-shared';

const page = tagListDocumentSchema.parse(await response.json());
const users = page.included?.filter(resource => resource.type === 'User');
```

Type a request with its document type (the schemas' output), and a query with
the collection's sort fields:

```ts
import type {TagCreateDocument, TagSortField} from '@commandsnippets/api-shared';

const body: TagCreateDocument = {data: {type: 'Tag', attributes: {name}}};
const sort: TagSortField = 'order';
```

Error responses parse with `errorDocumentSchema`; branch on `CODES`
(`CODES.permissionDenied`) rather than on messages.

## Adding a schema

1. Put it with its resource in `src/resources/` (or next to the generic
   helpers, if it is one), built from the helpers: `charField` and friends for
   request fields, `createDocumentSchema`/`updateDocumentSchema` for request
   documents, `listQuerySchema` for a collection's query,
   `resourceSchema`/`relatedResourceSchema` and `documentSchema`/
   `listDocumentSchema` for responses. A new relationship goes in
   `RELATIONSHIPS` (and `DEFAULT_INCLUDES`).
2. Any new error text goes in `MESSAGES` (and a new code in `CODES`), worded
   exactly as the API sends it. Report failures with `fail(ctx, message, meta)`
   or `check(message, code)`, never zod's default messages.
3. Export the schema and its `z.output` type; `src/index.ts` re-exports each
   module.
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
