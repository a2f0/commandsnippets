## Committing

- Use conventional commit syntax when committing files.
- Do not commit changes unless you are explicitly asked to.
- Never force push to shared branches. Always pull the latest changes (e.g., using `git pull --rebase`) and resolve conflicts locally before pushing.

## File Naming

- Name new files with camel case.

## Linting & Formatting

- Always run `pnpm run lint` and `pnpm run format` to test changes.
- Never add linting or formatting exceptions in code.

## Dependencies

- Always pin dependencies with `--save-exact` when modifying package.json.

## TypeScript

- Always use `pnpm tsc -b` after making changes to make sure TypeScript compiles.
- Never use `any` as a type, or `as` for type assertion.

## Package Manager

- Always use `pnpm` for the JavaScript package manager.

## Language

- Always write code in TypeScript, never JavaScript.

## Testing

- Run unit tests with `scripts/runSpecHeadless.sh <spec-file>`.
