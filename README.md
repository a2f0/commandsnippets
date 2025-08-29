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
- **App Name**: Tearleads Frontend
- **Package ID**: com.tearleads.app
- **Web Directory**: build

### Building for Mobile Platforms

1. First, build the web application:
```shell
pnpm run build
```

2. Sync the web build with native platforms:
```shell
npx cap sync
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
pnpm run dev --host
```

2. Update `capacitor.config.ts` temporarily to point to your local server:
```javascript
const config: CapacitorConfig = {
  // ... other config
  server: {
    url: 'http://YOUR_LOCAL_IP:5173',
    cleartext: true
  }
};
```

3. Run the app on your device/simulator through Xcode or Android Studio

Remember to remove the server configuration before building for production.

### Updating Native Projects

After installing new Capacitor plugins:
```shell
npx cap sync
```

To update native project dependencies:
```shell
npx cap update
```

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
