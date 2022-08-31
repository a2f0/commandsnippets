# Tearleads Frontend

## Development

Development

```shell
pip install pre-commit
pre-commit install
npm install
npm run server
```

## Coding Standards

1. Use camel case for element IDs, i.e. `id=tagsEntriesContextMenu1Untag`

## Testing

Start the server and run tests

```shell
npm run ci
npm run ci-headless
```

Start the testing webpack server (on different port than normal development server) and run tests manually.

```shell
npm run server-test
# in a different console tab
npm run test
npm run test-headless
```

Run a specific spec

```shell
npm run server-test
npx wdio wdio.shared.conf.ts --spec=./specs/tags/search
```

Run jest tests

```shell
npx jest
npx jest --watch
```
