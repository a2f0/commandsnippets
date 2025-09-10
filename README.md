# Tearleads Frontend

A command snippet tool for computer programmers and system administrators. It's a tagging system that allows for user-defined ordering of both Tag and Entry objects, using MobX-State-Tree for local data persistence and synchronization.

## Development

### Prerequisites

### Setup

```shell
npm i -g pnpm
# Install dependencies
pnpm install

# Install pre-commit hooks
pip install pre-commit
pre-commit install
pre-commit run --all-files

# Start development server
pnpm run dev
```

## Code Quality

Run linting and formatting:

```shell
pnpm run lint
pnpm run format
```

Run TypeScript compilation check:

```shell
npx tsc -b
```

## Mobile Development with Capacitor

This project includes Capacitor for building native iOS and Android apps from the web application.

### Capacitor Setup

Capacitor is already configured with:
- **App Name**: Tearleads Frontend (Tearleads for production, Tearleads Staging for staging)
- **Package ID**: com.tearleads.app (production) / com.tearleads.app.staging (staging)
- **Web Directory**: build

### Environment Configuration

The app supports different environments for Capacitor builds:
- **Development**: For local development with live reload (default when using `capacitor.config.ts`)
- **Staging**: Points to https://app.staging.tearleads.com (uses `capacitor.config.staging.ts`)
- **Production**: Uses bundled assets for app stores (uses `capacitor.config.production.ts`)

Environment detection is handled automatically in `src/lib/environment.ts`:
- Capacitor apps use Vite's MODE environment variable to determine the environment
- Web apps use hostname-based detection
- Default is 'development' for Capacitor during development

### Building for Mobile Platforms

#### Production Build
```shell
# Build and sync for production
pnpm run cap:build:production
```

#### Staging Build
```shell
# Build and sync for staging
pnpm run cap:build:staging
```

#### Manual Build Steps
1. First, build the web application:
```shell
# For production
pnpm run build:production

# For staging
pnpm run build:staging
```

2. Sync the web build with native platforms:
```shell
# For production
pnpm run cap:sync:production

# For staging
pnpm run cap:sync:staging
```

### iOS Development

Open the iOS project in Xcode:
```shell
npx cap open ios
```

Requirements:
- macOS with Xcode installed
- iOS Developer Account (for device testing)
- CocoaPods (automatically installed with Capacitor)

### Android Development

Open the Android project in Android Studio:
```shell
npx cap open android
```

Requirements:
- Android Studio installed
- Android SDK configured
- Java Development Kit (JDK) 11 or higher

### Live Reload During Development

For development with live reload on mobile:

1. Start the development server:
```shell
pnpm run dev -- --host --port 8085
```

2. The default `capacitor.config.ts` automatically detects your local IP address for development:
```javascript
const config: CapacitorConfig = {
  // ... other config
  server: {
    url: `http://${localIp}:8085`,  // Automatically uses your machine's IP
    cleartext: true
  }
};
```

3. Sync and run the app:
```shell
npx cap sync
```

4. Run the app on your device/simulator through Xcode or Android Studio

Note: The development config is separate from staging/production configs which are in `capacitor.config.staging.ts` and `capacitor.config.production.ts`.

### Updating Native Projects

After installing new Capacitor plugins:
```shell
npx cap sync
```

To update native project dependencies:
```shell
npx cap update
```

### Troubleshooting

**App shows "Could not connect to server" error:**
- Ensure the dev server is running with `pnpm run dev --host`
- The IP address in `capacitor.config.ts` is automatically detected using the `ip` package
- Check that your device/simulator is on the same network as your development machine
- The dev server runs on port 8085, not 5173.

**Changes not appearing in the app:**
- Run `npx cap sync` after configuration changes
- In Xcode: Clean build folder (Shift+Cmd+K) and rebuild
- Ensure live reload is working by checking the server URL in `capacitor.config.ts`

**Environment detection issues:**
- Capacitor apps automatically detect as 'development' when using the default config
- For staging/production builds, use the specific build commands that set the correct environment variables

## Other

- Please see the [wiki](https://github.com/a2f0/tearleads-frontend/wiki) for coding standards and other important information

## Testing

### E2E Tests

Start the server and run tests in a single command:

```shell
pnpm run ci
pnpm run ci-headless
```

Start the testing server (on different port than normal development server), and then run tests manually in a separate command:

```shell
pnpm run server-test
# in a different console tab
pnpm run test
pnpm run test-headless
```

Run a specific spec:

```shell
pnpm run server-test
pnpm run test -- --spec=test/specs/entries/entriesContextMenu.spec.ts
```

or

```shell
./scripts/runSpec.sh test/specs/tags/tagContextMenu/allowsDeletingATag.spec.ts
```

### Unit Tests

Run unit tests:

```shell
pnpm run unit
pnpm run unit -- --watch
pnpm run unit -- __tests__/reorderEntryList.spec.tsx
```
