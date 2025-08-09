# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- `pnpm run fix` - Auto-fix linting issues
- `npx tsc -b` or `pnpm run compile` - TypeScript compilation check

### Testing

#### E2E Tests (WebdriverIO)
- `pnpm run ci` - Start server and run E2E tests
- `pnpm run ci-headless` - Start server and run E2E tests headless
- `pnpm run server-test` - Start testing server on port 8081
- `pnpm run test` - Run E2E tests (requires server-test running)
- `pnpm run test-headless` - Run E2E tests headless
- `pnpm start-server-and-test server-test http-get://localhost:8081 "NODE_OPTIONS='--experimental-specifier-resolution=node --no-warnings' npx wdio test/wdio.headless.conf.ts --spec test/specs/tags/tagListContextMenu.spec.ts"` - Run specific spec

#### Unit Tests (Vitest)
- `pnpm run unit` - Run unit tests
- `pnpm run unit -- --watch` - Run unit tests in watch mode
- `pnpm run unit -- __tests__/reorderEntryList.spec.tsx` - Run specific unit test

### Build
- `pnpm run build` - Build production bundle
- `pnpm run postbuild` - Post-build script
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
- MSW is automatically enabled in development mode
- Both IndexedDB (offline) and SQLite (sync) database adapters available
- User-defined ordering is a key feature for both Tags and Entries
