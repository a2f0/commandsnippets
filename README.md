# Tearleads Frontend

## Development

Development

```shell
pip install pre-commit
pre-commit install
pre-commit run --all-files
npm install
npm run server
```

## Wiki

Please see the [wiki](https://github.com/a2f0/tearleads-frontend/wiki) for coding standards and other important information.

## Testing

Start the server and run tests in a single command.

```shell
npm run ci
npm run ci-headless
```

Start the testing webpack server (on different port than normal development server), and then run tests manually in a separate command.

```shell
npm run server-test
# in a different console tab
npm run test
npm run test-headless
```

Run a specific spec

```shell
npm run server-test
npm run test -- --spec=test/specs/entries/entriesContextMenu.spec.ts
```

Run jest tests

```shell
npm run unit
npm run unit --  --watch
npm run unit -- __tests__/reorderEntryList.spec.tsx
```
