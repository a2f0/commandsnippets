# AGENTS.md

This file provides guidance to AI coding assistants (Claude Code, Gemini Code Assist, etc.) when working with code in this repository.

## Project Overview

Tearleads is a command snippet tool for computer programmers and system administrators. It's a tagging system that allows for user-defined ordering of both Tag and Entry objects, using MobX-State-Tree for local data persistence and synchronization.

## Development Commands

### Setup
- `npm i -g pnpm` - Install pnpm globally
- `pnpm install` - Install dependencies
- `pnpm run dev` - Start development server on http://localhost:8085

### Code Quality
- `pnpm run lint` - Run Biome linting
- `pnpm run format` - Run Biome formatting
- `pnpm run fix` - Auto-fix linting and formatting issues (runs `biome check --write`)
- `pnpm run compile` or `npx tsc -b` - TypeScript compilation check

### Testing

#### Appium Mobile Testing (iOS)

For testing the Capacitor iOS app in simulator:

- `../scripts/runCapacitorTests.sh ios` - Run the same iOS build and test flow as CI (recommended)
- `pnpm run appium:ios` - Run Appium tests only (requires pre-built app)

**Prerequisites:**
- Xcode installed with iOS Simulator
- Xcode 26 or newer with an iOS Simulator available (iPhone 16 recommended)
- Capacitor staging app built and synced

**Manual Setup Steps:**
1. Build the staging app: `pnpm run cap:build:staging`
2. Open Xcode: `open ios/App/App.xcworkspace`
3. Build for simulator: Product → Build For → Running (or use command line)
4. Run tests: `pnpm run appium:ios`

**Test Configuration:**
- Config: `test/wdio.appium.ios.conf.ts`
- Tests: `test/appium/ios/`
- Bundle ID: `com.tearleads.app`
- Screenshots: `logs/screenshots/`
- Logs: `logs/appium/`

**Recommended Approach: Use Staging Builds**
- Staging builds are more representative of production
- Proper bundle IDs and signing
- No dependency on dev server connectivity
- Better for automated testing pipelines

#### Appium Mobile Testing (Android)

For testing the Capacitor Android app in emulator:

- `../scripts/runCapacitorTests.sh android` - Run the same Android build and test flow as CI (recommended)
- `pnpm run appium:android` - Run Appium tests only (requires pre-built APK)

**Prerequisites:**
- Android SDK installed with Android Studio or command line tools
- Android Emulator available (API 36 recommended - Android 16)
- Java 21 installed
- ANDROID_HOME or ANDROID_SDK_ROOT environment variable set

**Manual Setup Steps:**
1. Setup Android environment: `./scripts/setup-appium-android.sh`
2. Start Android emulator: `emulator -avd <your-avd-name>`
3. Build the staging app: `pnpm run cap:build:staging`
4. Build APK: `cd android && ./gradlew assembleStagingDebug`
5. Run tests: `pnpm run appium:android`

**Test Configuration:**
- Config: `test/wdio.appium.android.conf.ts`
- Tests: `test/appium/android/`
- App Package: `com.tearleads.app`
- Screenshots: `logs/screenshots/`
- Logs: `logs/appium/`

**Android Emulator Requirements:**
- API Level 36 (Android 16) recommended
- x86_64 architecture for better CI performance
- Hardware acceleration enabled (KVM on Linux)
- Auto-grant permissions for smoother testing

#### E2E Tests (WebdriverIO)

When running integration tests, it is recommended to use the headless option. The headless configuration is defined in `test/wdio.headless.conf.ts`

- `../scripts/runWebdriverTests.sh` - Start the server and run the same headless E2E tests as CI (recommended)
- `pnpm run test-headless` - Run E2E tests headless (requires server-test running separately)
- `scripts/runSpecHeadless.sh <spec-file>` - Run specific spec file headless
- `scripts/runSpec.sh <spec-file>` - Run specific spec file with browser UI

#### Electron E2E Tests

Electron tests are separate from the main CI pipeline to avoid platform-specific issues in headless Linux environments.

- `pnpm run electron:test` - Run Electron E2E tests only (requires pre-built app)
- `pnpm run electron:build-and-test` - Build and test Electron app (recommended)

**Prerequisites:**
- Electron app built and packaged via `pnpm run electron:pack`
- Platform-specific executables available in `dist-electron/`
- Display environment (tests are skipped in CI on Linux)

**Test Configuration:**
- Config: `test/wdio.electron.conf.ts`
- Tests: `test/specs/electron/`
- Platform-aware: Automatically detects macOS, Windows, and Linux
- Excluded from `ci-headless` to prevent CI failures

**Platform Support:**
- **macOS**: `./dist-electron/mac-arm64/Tearleads.app`
- **Windows**: `./dist-electron/win-unpacked/Tearleads.exe`
- **Linux**: `./dist-electron/linux-unpacked/tearleads-frontend`

**CI Behavior:**
- Automatically skips on Linux CI environments without display
- Separated from web E2E tests to prevent build pipeline failures

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
- **StoreV2 Architecture**: New store system combining UI state with repository-managed data
- **Store**: Located in `src/lib/store/storeV2.ts` with migration utilities
- **Root Store**: `src/lib/store/models/RootStore.ts` contains the main store model
- **UI State**: `src/lib/store/models/UIStateModel.ts` manages UI-specific state
- **Data Repository**: `src/lib/store/repository/DataRepository.ts` handles data persistence
- **Context**: React context provider in `src/AppContext.tsx` with async initialization
- **Migration**: Automatic migration from legacy MobX-State-Tree format

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
- Use `useAppContext()` hook to access the StoreV2 store
- Store initialization is async - handle loading states properly
- Components are organized by feature (tags, entries, menus, etc.)
- MSW is automatically enabled in test mode only (not in development)
- Multiple adapter support: Dexie (IndexedDB), LocalStorage, and Turso (SQLite)
- User-defined ordering is a key feature for both Tags and Entries
- Unauthorized access handling via store registration pattern

## Documentation Maintenance

- When you encounter errors in the documentation (e.g., outdated commands, incorrect descriptions) or identify areas where existing documentation could be refined for clarity or accuracy, please update this `AGENTS.md` file accordingly.

### Architectural Migrations
When implementing major architectural changes (like the StoreV2 migration):

#### Planning Phase
- **Create comprehensive migration plan**: Break down the change into logical steps
- **Identify all affected files**: Use grep/search tools to find dependencies
- **Design backward compatibility**: Implement migration utilities for existing data
- **Plan test strategy**: Update test utilities and patterns as needed

#### Implementation Phase
- **Use feature branches**: Create descriptive branch names (e.g., `feat-migrate-to-v2-store`)
- **Implement gradually**: Start with core changes, then update dependent files
- **Maintain async patterns**: Handle initialization properly with loading states
- **Update tests incrementally**: Refactor test utilities alongside main code

#### Testing Strategy
- **Test migration path**: Ensure old data formats are properly migrated
- **Verify backward compatibility**: Test that existing functionality still works
- **Update test patterns**: Improve testing approaches where possible (e.g., `screen.findBy*` vs `waitFor`)
- **Test error scenarios**: Ensure graceful handling of migration failures

#### Documentation
- **Update AGENTS.md immediately**: Document new patterns and architectures
- **Include migration notes**: Explain what changed and why
- **Update code examples**: Ensure documentation reflects new patterns

## Development Guidelines

### Committing
- Use conventional commit syntax when committing files
- **ALWAYS sign commits with GPG** - NEVER use `--no-gpg-sign` or create unsigned commits
- **Avoid rewriting history on shared branches**: While tools like `git rebase -i` are useful for cleaning up local commits, they rewrite history and can remove GPG signatures. If you rebase, ensure you re-sign all commits. Never force-push to shared branches or branches with active pull requests.
- **IMPORTANT**: Only commit changes when explicitly instructed to do so in the current message. Do not infer commit instructions from the conversation history.
- Never force push to shared branches
- Always pull the latest changes (e.g., using `git pull --rebase`) and resolve conflicts locally before pushing

### File Naming
- Name new files with camel case

### Linting & Formatting
- Always run `pnpm run lint` and `pnpm run format` to test changes
- Always ensure `biome check --write` passes without errors when making changes
- Use `pnpm run fix` (which runs `biome check --write`) to automatically fix issues
- Never add linting or formatting exceptions in code

#### Pre-commit Hook Handling
- Pre-commit hooks automatically fix formatting and linting issues
- If hooks fail with TypeScript or other errors, fix them before retrying
- Use `git commit --no-verify` only as a last resort when creating PRs for code review
- Always address hook feedback rather than bypassing - the hooks ensure code quality

**When pre-commit hooks modify files:**
1. If the commit fails and says "files were modified by this hook", the hooks have auto-fixed issues
2. Stage the modified files again with `git add .`
3. Re-run the commit command with the same message
4. The second commit should succeed with all hooks passing

Example workflow:
```bash
# First commit attempt - hooks fix issues
git add .
git commit -m "fix: your commit message"
# If hooks modified files, you'll see "files were modified by this hook"

# Stage the hook-modified files
git add .

# Retry the same commit
git commit -m "fix: your commit message"
# Should succeed with "Passed" for all hooks
```

#### GPG Signing Best Practices
- **Always verify signatures**: Use `git log --show-signature` to check commit signatures
- **Avoid history rewrite operations on shared branches**: Operations like `git filter-branch`, `git rebase -i` remove signatures and should not be used on shared or protected branches
- **Verify before pushing**: Check signatures with `git verify-commit HEAD` before pushing

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
- **Use invariant for strict null checks**: When working with potentially null DOM elements or values that should exist but may be null according to TypeScript, use the `invariant` library for runtime assertions:
  ```typescript
  import invariant from 'invariant';

  // Instead of:
  const element = container.firstElementChild;
  const styles = window.getComputedStyle(element as Element);

  // Use:
  const element = container.firstElementChild;
  invariant(element, 'element should exist');
  const styles = window.getComputedStyle(element);
  ```
- This approach provides better error messages and satisfies TypeScript's strict null checks without unsafe type assertions

### Package Manager
- Always use `pnpm` for the JavaScript package manager

### Language
- Always write code in TypeScript, never JavaScript

### Console Output & Logging
- **Never use colored emojis** (🚀🔨📱✅❌⚠️🔍📁🧪📊🔄) in console output, error messages, or logging
- Use clear ASCII text prefixes instead: `OK:`, `ERROR:`, `WARNING:`, `SUCCESS:`, `PASS:`, `FAIL:`
- Unicode characters for expression are acceptable (e.g., →, ×, ✓ as text), but avoid colorful emoji characters
- Keep output professional and terminal-friendly

**Example:**
```typescript
// DO NOT:
console.log('✅ Build completed successfully');
console.error('❌ Build failed');

// DO:
console.log('OK: Build completed successfully');
console.error('ERROR: Build failed');
```

### Testing
- Run unit tests with `pnpm run unit` or specific tests with path (e.g., `pnpm run unit -- __tests__/reorderEntryList.spec.tsx`)
- Run E2E tests with `pnpm run ci-headless` for full suite
- Run specific E2E test with `scripts/runSpecHeadless.sh <spec-file>` (e.g., `scripts/runSpecHeadless.sh test/specs/tags/search.spec.ts`)

#### Testing Best Practices
- Use `LoggedInAppContextProvider` from `__tests__/util/LoggedInAppContextProvider.tsx` for unit tests requiring authenticated state
- Prefer `screen.findBy*` over `waitFor(() => screen.getBy*)` for async elements - it's more reliable and concise
- Use `act()` wrapper for async renders: `await act(async () => render(<Component />))`
- Test utilities in `__tests__/util/loggedInStore.ts` provide pre-configured store instances
- Store instances are cached and reset between tests for isolation

## GitHub CI/CD Management

### Checking CI/CD Status and Failures

When CI/CD builds fail, use these commands to investigate and resolve issues:

#### 1. Check Recent CI/CD Runs
```bash
# List recent GitHub Actions runs
gh run list --limit 5

# Get detailed info on latest run with JSON output
gh run list --limit 1 --json status,conclusion,headBranch,workflowName,createdAt,url

# Check status of specific run
gh run view <RUN_ID>
```

#### 2. Get CI/CD Failure Details
```bash
# View full logs of a failed run
gh run view <RUN_ID> --log

# View only failed job logs (more focused)
gh run view <RUN_ID> --log-failed

# Download artifacts from failed run (useful for test videos/screenshots)
gh run download <RUN_ID>
```

#### 3. Common CI/CD Failure Patterns
- **E2E Test Flakiness**: Look for timing issues, missing waits, or MSW state problems
- **Linting/Formatting**: Run `pnpm run fix` locally to resolve
- **TypeScript Errors**: Run `pnpm run compile` to identify and fix type issues
- **Dependency Issues**: Check for missing or incorrectly pinned dependencies

#### 4. Typical Workflow for CI/CD Failures
```bash
# 1. Check what failed
RUN_ID=$(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$RUN_ID" --log-failed

# 2. Reproduce locally
pnpm run ci-headless  # for E2E test failures
pnpm run unit         # for unit test failures
pnpm run lint         # for linting failures
pnpm run compile      # for TypeScript failures

# 3. Fix the issue and test locally
# 4. Commit the fix
# 5. Push to trigger new CI/CD run
```

#### 5. E2E Test Stability Best Practices
- Always check `tagLine` **before** login, not after (avoids re-render race conditions)
- Add explicit waits for MSW data loading before assertions
- Ensure all test files have `afterEach` MSW reset handlers
- Use `browser.waitUntil()` for async conditions instead of immediate expectations

## GitHub Pull Request Management

### Creating Effective Pull Requests
When creating PRs for code review by AI agents like `@gemini-code-assist`:

- **Use descriptive titles**: Follow conventional commit format for PR titles
- **Provide comprehensive summaries**: Include bullet points for major changes
- **Add test plan**: List specific testing steps and commands to run
- **Mention known issues**: Call out any warnings or issues that need addressing
- **Request specific feedback**: Ask for review on particular aspects (architecture, TypeScript issues, testing patterns, etc.)
- **Include file references**: Mention key changed files to guide the review

#### Example PR Request Comment
```
@gemini-code-assist

Please review this PR which implements [brief description].

I'd appreciate your feedback on:
1. **Code Quality**: Any bugs, anti-patterns, or improvements?
2. **TypeScript Issues**: Help resolving type warnings?
3. **Testing Patterns**: Do the test changes look correct?
4. **Architecture**: Is the new architecture maintainable?

Key files changed: `src/path/to/file.ts`, `__tests__/util/helper.ts`
```

### Handling PR Feedback from Code Review Agents

When receiving feedback from AI code review agents like `@gemini-code-assist[bot]`, follow this systematic approach:

**⚠️ GitHub Reference Warning**: Avoid using the `#` symbol when communicating with AI agents, as it causes GitHub to generate unwanted links to issues and PRs. Use alternative reference formats (see examples below).

#### 1. Scrape and Analyze Feedback
```bash
# Get all review comments from gemini-code-assist with URLs
gh api repos/a2f0/tearleads-frontend/pulls/comments/<PR_NUMBER> --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | {id: .id, body: .body, path: .path, line: .line, url: .html_url}'

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
              url
            }
          }
        }
      }
    }
  }
}'
```

**Creating comment URLs from IDs**:
```bash
# For review comments (discussion_r format)
echo "https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#discussion_r<COMMENT_ID>"

# For general PR comments (issuecomment format)
echo "https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#issuecomment-<COMMENT_ID>"

# Extract comment ID from API response and create URL
COMMENT_ID=$(gh api repos/a2f0/tearleads-frontend/pulls/comments/<PR_NUMBER> --jq '.[0].id')
echo "https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#discussion_r${COMMENT_ID}"
```

**Finding the correct comment ID to reply to**:
```bash
# Get specific comment details including ID for replies
gh api repos/a2f0/tearleads-frontend/pulls/comments/<PR_NUMBER> \
  --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | {id: .id, body: .body[0:100], path: .path, line: .line}' \
  | head -5

# Get the comment ID for a specific file and line
gh api repos/a2f0/tearleads-frontend/pulls/comments/<PR_NUMBER> \
  --jq '.[] | select(.path == "src/file.ts" and .line == 42) | .id'
```

#### 2. Address Issues and Commit Fixes
- Create conventional commits that address the specific feedback
- Include commit hash references when responding to review comments
- Ensure all fixes pass tests: `pnpm run unit`, `pnpm tsc -b`, `pnpm biome check --fix`

#### 3. Tag and Confirm Resolution
For each addressed issue, tag the review agent and ask for confirmation:

**CRITICAL**: NEVER respond to individual issues in the main PR body. ALWAYS reply directly to the specific conversation thread. This keeps discussions organized and contextual.

**⚠️ IMPORTANT FOR AI ASSISTANTS**: When engaging with code review agents like @gemini-code-assist, you MUST:
- Use `gh api repos/.../pulls/<PR_NUMBER>/comments/<COMMENT_ID>/replies` to reply to specific threads
- NEVER use `gh pr comment <PR_NUMBER>` for addressing individual review feedback
- Only use `gh pr comment` for general PR-level discussions or initial review requests
- Always find the specific comment database ID and reply directly to that thread

```bash
# Find the comment ID from the thread you want to reply to
gh api graphql --field query='
{
  repository(owner: "a2f0", name: "tearleads-frontend") {
    pullRequest(number: <PR_NUMBER>) {
      reviewThreads(first: 100) {
        nodes {
          id
          comments(first: 10) {
            nodes {
              databaseId
              body
              author {
                login
              }
            }
          }
        }
      }
    }
  }
}' | jq -r '.data.repository.pullRequest.reviewThreads.nodes[] | select(.id == "THREAD_ID") | .comments.nodes[] | select(.author.login == "gemini-code-assist[bot]") | .databaseId' | head -1

# Reply directly to the specific comment in the thread
gh api repos/a2f0/tearleads-frontend/pulls/<PR_NUMBER>/comments/<COMMENT_DATABASE_ID>/replies \
  --method POST \
  --raw-field body="@gemini-code-assist

I've addressed this issue in commit <COMMIT_HASH>:

✅ **What was fixed**: [Describe the fix]
✅ **How it was fixed**: [Describe the approach]

Has this issue been resolved to your satisfaction?"
```

**Note**: Use `--raw-field` instead of `--field` for multi-line body content to avoid parsing issues. Always use the database ID (numeric) for comment replies, not the node ID.

**Comment URL formats**:
- **Review comments**: `https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#discussion_r<COMMENT_ID>`
- **General PR comments**: `https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#issuecomment-<COMMENT_ID>`
- **Issue comments**: `https://github.com/a2f0/tearleads-frontend/issues/<ISSUE_NUMBER>#issuecomment-<COMMENT_ID>`

#### 4. Monitor for Response
Gemini typically responds within a few minutes. You can monitor for new comments:

```bash
# Watch for new comments from Gemini
gh pr view <PR_NUMBER> --comments | grep -A5 "gemini-code-assist" | tail -20

# Check for recent Gemini comments with timestamps
gh api repos/a2f0/tearleads-frontend/issues/<PR_NUMBER>/comments \
  --jq '.[] | select(.user.login == "gemini-code-assist[bot]") | {created: .created_at, body: .body[0:200]}'
```

#### 5. Resolve Confirmed Conversations
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

#### 6. Verify Resolution Status
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

#### Complete Workflow Example
```bash
# 1. Find the specific comment to reply to
COMMENT_ID=$(gh api repos/a2f0/tearleads-frontend/pulls/comments/123 \
  --jq '.[] | select(.user.login == "gemini-code-assist[bot]" and .path == "src/components/Button.tsx") | .id')

# 2. Make your code changes and commit
git add src/components/Button.tsx
git commit -m "fix: address TypeScript error in Button component"
COMMIT_HASH=$(git rev-parse HEAD)

# 3. Reply directly to the comment thread
gh api repos/a2f0/tearleads-frontend/pulls/123/comments/${COMMENT_ID}/replies \
  --method POST \
  --raw-field body="@gemini-code-assist

I've addressed the TypeScript error in commit ${COMMIT_HASH}:

✅ **What was fixed**: Added proper type annotation for the \`variant\` prop
✅ **How it was fixed**: Updated the interface to include all valid Material-UI button variants

Has this issue been resolved to your satisfaction?"

# 4. Wait for confirmation before resolving the thread
```

#### Best Practices
- **NEVER reply in the main PR body for individual issues** - this clutters the main discussion
- **ALWAYS reply directly to conversation threads** - keeps discussions organized and contextual
- **Always wait for confirmation** before resolving conversations
- **Batch similar fixes** into logical commits with clear messages
- **Document the resolution process** in thread replies for transparency
- **Keep unaddressed items open** until they're actually implemented
- **Use thread IDs from GraphQL**, not REST API comment IDs for resolution
- **Tag the AI agent** in thread replies to ensure they see your response
- **Use database IDs (numeric) for comment replies**, not node IDs (alphanumeric)

**⚠️ FOR AI ASSISTANTS - CRITICAL DISTINCTION**:
- `gh pr comment <PR_NUMBER>` = Posts to main PR body (only for general discussions)
- `gh api repos/.../pulls/<PR_NUMBER>/comments/<COMMENT_ID>/replies` = Replies to specific thread (required for review feedback)

**When to use each**:
- **Initial review request**: Use `gh pr comment` to ask for general review
- **Addressing specific feedback**: Use comment replies API to respond to individual threads
- **General updates**: Use `gh pr comment` for broad status updates
- **Thread-specific responses**: Use comment replies API for targeted responses

#### Common Gemini Review Patterns

Based on typical feedback patterns, Gemini often focuses on:

1. **Testing Improvements**: Replacing `waitFor(() => screen.getBy*)` with `screen.findBy*`
2. **Architectural Concerns**: Suggesting better separation of concerns and maintainable patterns
3. **TypeScript Issues**: Identifying type safety improvements and proper typing
4. **Code Quality**: Anti-patterns, performance issues, and maintainability concerns

**Quick Resolution Workflow**:
```bash
# 1. Get unresolved threads with comment IDs
gh api graphql --field query='{repository(owner:"a2f0",name:"tearleads-frontend"){pullRequest(number:<PR_NUMBER>){reviewThreads(first:20){nodes{id isResolved comments(first:3){nodes{databaseId body author{login}}}}}}}}' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false and any(.comments.nodes[]; .author.login == "gemini-code-assist[bot]"))'

# 2. Address issues and commit
git add -A && git commit -m "fix: address review feedback"
COMMIT_HASH=$(git rev-parse HEAD)

# 3. Reply directly to the thread (NEVER use gh pr comment for individual issues)
COMMENT_ID=$(gh api graphql --field query='{...}' | jq -r '...gemini comment databaseId...')
gh api repos/a2f0/tearleads-frontend/pulls/<PR_NUMBER>/comments/${COMMENT_ID}/replies \
  --method POST \
  --raw-field body="@gemini-code-assist I've addressed this in commit ${COMMIT_HASH}: [details]"

# 4. Wait for response, then resolve threads when confirmed
gh api graphql --field query='mutation{resolveReviewThread(input:{threadId:"THREAD_ID"}){thread{id isResolved}}}'
```

**⚠️ REMEMBER FOR AI ASSISTANTS**:
- Step 3 uses the comment replies API endpoint - this is mandatory for thread responses
- Do NOT replace step 3 with `gh pr comment` - that would post to main PR body instead of the thread
- The `/replies` endpoint ensures the response appears in the correct conversation thread

### Guidelines for AI Code Review Agents

When responding to PR comments or providing feedback:

#### Comment Reference Format
**❌ AVOID**: Using `#` symbol in references
- `#123` (creates unwanted GitHub issue link)
- `#discussion_r123456789` (creates unwanted link)
- `See #45 for context` (creates unwanted PR link)

**✅ USE**: Hyperlinks to actual comments
- `[this comment](https://github.com/a2f0/tearleads-frontend/pull/123#discussion_r456789)`
- `[review feedback](https://github.com/a2f0/tearleads-frontend/pull/123#issuecomment-789012)`
- `[See PR 45](https://github.com/a2f0/tearleads-frontend/pull/45)` for context

#### Response Templates
When acknowledging fixes or providing feedback:
```
**Issue Resolved**: [Description]
**Reference**: [original comment](https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#discussion_r<COMMENT_ID>)
**Solution**: [What was implemented]
```

#### Creating Comment URLs
- **Review comments**: `https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#discussion_r<COMMENT_ID>`
- **PR comments**: `https://github.com/a2f0/tearleads-frontend/pull/<PR_NUMBER>#issuecomment-<COMMENT_ID>`
- **Commit comments**: `https://github.com/a2f0/tearleads-frontend/commit/<COMMIT_SHA>#commitcomment-<COMMENT_ID>`

#### Markdown Formatting
- Use bullet points and checkmarks for clarity
- Create descriptive hyperlink text instead of showing raw URLs
- Use `[descriptive text](URL)` format for all comment references
