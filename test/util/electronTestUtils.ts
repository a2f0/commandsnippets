import {platform} from 'node:os';

/**
 * Determine the correct Electron app path based on platform.
 * Returns the path to the actual executable file for WebDriverIO tests.
 */
export function getElectronAppExecutablePath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      // macOS - Point to the actual executable inside the .app bundle
      return './dist-electron/mac-arm64/Tearleads.app/Contents/MacOS/Tearleads';
    }
    case 'win32': {
      return './dist-electron/win-unpacked/Tearleads.exe';
    }
    case 'linux': {
      // Linux executable is named after the package name, not productName
      return './dist-electron/linux-unpacked/tearleads-frontend';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

/**
 * Get the Electron app bundle/directory path for file system checks.
 * Returns the path to the app bundle/directory (not the executable itself).
 */
export function getElectronAppBundlePath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      return './dist-electron/mac-arm64/Tearleads.app';
    }
    case 'win32': {
      return './dist-electron/win-unpacked/Tearleads.exe';
    }
    case 'linux': {
      return './dist-electron/linux-unpacked/tearleads-frontend';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}
