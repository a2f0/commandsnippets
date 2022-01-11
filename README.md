# Tearleads Frontend

## Development

Development

```shell
pip install pre-commit
pre-commit install
npm install
npm run server
```

## Testing

Start the server and run tests

```shell
npm run ci
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
npx wdio wdio.shared.conf.ts --spec=./specs/tags/search
```
