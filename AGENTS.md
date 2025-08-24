# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, Gemini Code Assist, etc.) when working with code in this repository.

## Project Overview

Tearleads is a command snippet tool for computer programmers and system administrators. It's a tagging system that allows for user-defined ordering of both Tag and Entry objects, using MobX-State-Tree for local data persistence and synchronization.

## Development Commands

### Setup
- `npm i -g pnpm` - Install pnpm globally
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development server on http://localhost:8080

### Code Quality
- `pnpm run lint` - Run Biome linting
- `pnpm run format` - Run Biome formatting
- `pnpm run fix` - Auto-fix linting and formatting issues (runs `biome check --write`)
- `pnpm run compile` or `npx tsc -b` - TypeScript compilation check

### Testing


#### E2E Tests (WebdriverIO)

When running integration tests, it is recommended to use the headless option. The headless configuration is defined in `test/wdio.headless.conf.ts`

- `pnpm run ci-headless` - Start server and run E2E tests headless (recommended)
- `pnpm run test-headless` - Run E2E tests headless (requires server-test running separately)
- `scripts/runSpecHeadless.sh <spec-file>` - Run specific spec file headless
- `scripts/runSpec.sh <spec-file>` - Run specific spec file with browser UI

#### Unit Tests (Vitest)
- `pnpm run unit` - Run unit tests
- `pnpm run unit -- --watch` - Run unit tests in watch mode
- `pnpm run unit -- __tests__/reorderEntryList.spec.tsx` - Run specific unit test

### Build
- `pnpm run build` - Build production bundle
- `pnpm run build:analyze` or `pnpm run analyze` - Build with bundle analysis
- `pnpm run postbuild` - Post-build script (runs automatically after build)
- `pnpm run clean` - Remove build directory

## Architecture

### State Management
- **MobX-State-Tree**: Core state management with local persistence
- **Store**: Located in `src/lib/store/store.ts`
- **Root Model**: `src/lib/store/models/RootModel.ts` contains the main MST model
- **Context**: React context provider in `src/AppContext.tsx`

### Database Layer
- **Dual Adapters**: Dexie (IndexedDB) and Turso (SQLite) adapters in `src/lib/db/adapters/`
- **Types**: Database interfaces defined in `src/lib/db/types.ts`
- **Main DB Module**: `src/lib/db/db.ts` handles database operations

### Core Components
- **Tag System**: `src/Tag.tsx`, `src/TagList.tsx` - User-defined tagging with ordering
- **Entry System**: `src/Entry.tsx`, `src/EntryList.tsx` - Command snippets with tagging
- **Context Menus**: Various context menu components for Tags and Entries
- **Drag & Drop**: `src/DragHandle.tsx` and `src/DragHandleContainer.tsx` for reordering

### UI Framework
- **Material-UI**: Primary component library
- **Emotion**: CSS-in-JS styling
- **React Router**: Client-side routing
- **React DnD**: Drag and drop functionality

### Testing Setup
- **Mock Service Worker (MSW)**: API mocking for development and testing
  - Service worker: `public/mockServiceWorker.js`
  - Initialization: `src/msw.ts`
  - Test mocks: `test/mocks/` directory
- **WebdriverIO**: E2E testing framework with Chrome/Firefox support
- **Vitest**: Unit testing with jsdom environment

### Build Configuration
- **Vite**: Modern build tool with React plugin
- **PWA**: Progressive Web App capabilities via vite-plugin-pwa
- **TypeScript**: Strict configuration with multiple tsconfig files
- **Biome**: Linting and formatting

### Important Patterns
- Use `useAppContext()` hook to access the MobX-State-Tree store
- Components are organized by feature (tags, entries, menus, etc.)
- MSW is automatically enabled in test mode only (not in development)
- Both IndexedDB (offline) and SQLite (sync) database adapters available
- User-defined ordering is a key feature for both Tags and Entries

## Development Guidelines

### Committing
- Use conventional commit syntax when committing files
- Do not commit changes unless explicitly asked to
- Never force push to shared branches
- Always pull the latest changes (e.g., using `git pull --rebase`) and resolve conflicts locally before pushing

### File Naming
- Name new files with camel case

### Linting & Formatting
- Always run `pnpm run lint` and `pnpm run format` to test changes
- Always ensure `biome check --write` passes without errors when making changes
- Use `pnpm run fix` (which runs `biome check --write`) to automatically fix issues
- Never add linting or formatting exceptions in code

### Dependencies
- Always pin dependencies to exact versions (no ^ or ~ prefix) when adding or updating packages
- Use `pnpm add --save-exact <package>` for new dependencies
- Use `pnpm add -D --save-exact <package>` for new dev dependencies
- When manually editing package.json, ensure version numbers have no range specifiers
- Always run `pnpm install` after modifying package.json to update pnpm-lock.yaml
- Never commit package.json changes without the corresponding pnpm-lock.yaml updates
- When removing dependencies, use `pnpm remove <package>` to update both package.json and pnpm-lock.yaml

### TypeScript
- Always use `pnpm run compile` (or `npx tsc -b`) after making changes to ensure TypeScript compiles
- Never use `any` as a type, or `as` for type assertion

### Package Manager
- Always use `pnpm` for the JavaScript package manager

### Language
- Always write code in TypeScript, never JavaScript

### Testing
- Run unit tests with `pnpm run unit` or specific tests with path (e.g., `pnpm run unit -- __tests__/reorderEntryList.spec.tsx`)
- Run E2E tests with `pnpm run ci-headless` for full suite
- Run specific E2E test with `scripts/runSpecHeadless.sh <spec-file>` (e.g., `scripts/runSpecHeadless.sh test/specs/tags/search.spec.ts`)

## GitHub Pull Request Management

### Handling PR Feedback from Code Review Agents

When receiving feedback from AI code review agents like `@gemini-code-assist[bot]`, follow this systematic approach:

#### 1. Scrape and Analyze Feedback
```bash
# Get all review comments from gemini-code-assist
gh api repos/a2f0/tearleads-frontend/pulls/comments/<PR_NUMBER> --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | {id: .id, body: .body, path: .path, line: .line}'

# Get review thread IDs and status
gh api graphql --field query='
{
  repository(owner: "a2f0", name: "tearleads-frontend") {
    pullRequest(number: <PR_NUMBER>) {
      reviewThreads(first: 20) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              body
            }
          }
        }
      }
    }
  }
}'
```

#### 2. Address Issues and Commit Fixes
- Create conventional commits that address the specific feedback
- Include commit hash references when responding to review comments
- Ensure all fixes pass tests: `pnpm run unit`, `pnpm tsc -b`, `pnpm biome check --fix`

#### 3. Tag and Confirm Resolution
For each addressed issue, tag the review agent and ask for confirmation:
```bash
gh pr comment <PR_NUMBER> --body "@gemini-code-assist

**Re: [Issue Description] (discussion_r<COMMENT_ID>)**

I've addressed this issue in commit <COMMIT_HASH>:

✅ **What was fixed**: [Describe the fix]
✅ **How it was fixed**: [Describe the approach]

Has this issue been resolved to your satisfaction?"
```

#### 4. Resolve Confirmed Conversations
Once the review agent confirms an issue is resolved, use GraphQL to mark the conversation as resolved:

```bash
# Single conversation resolution
gh api graphql --field query='
mutation {
  resolveReviewThread(input: {threadId: "THREAD_ID"}) {
    thread {
      id
      isResolved
    }
  }
}'

# Multiple conversations in one call
gh api graphql --field query='
mutation {
  r1: resolveReviewThread(input: {threadId: "THREAD_ID_1"}) {
    thread { id isResolved }
  }
  r2: resolveReviewThread(input: {threadId: "THREAD_ID_2"}) {
    thread { id isResolved }
  }
}'
```

#### 5. Verify Resolution Status
```bash
# Check which conversations remain unresolved
gh api graphql --field query='
{
  repository(owner: "a2f0", name: "tearleads-frontend") {
    pullRequest(number: <PR_NUMBER>) {
      reviewThreads(first: 20) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              body
            }
          }
        }
      }
    }
  }
}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | {id: .id, firstComment: .comments.nodes[0].body[0:100]}'
```

#### Best Practices
- **Always wait for confirmation** before resolving conversations
- **Batch similar fixes** into logical commits with clear messages
- **Document the resolution process** in PR comments for transparency
- **Keep unaddressed items open** until they're actually implemented
- **Use thread IDs from GraphQL**, not REST API comment IDs for resolution
