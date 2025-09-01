import {arch, platform} from 'node:os';

function getMacArchFolder(): string {
  // electron-builder uses 'mac' for x64 and 'mac-arm64' for arm64 by default.
  return arch() === 'arm64' ? 'mac-arm64' : 'mac';
}

/**
 * Determine the correct Electron app path based on platform.
 * Returns the path to the actual executable file for WebDriverIO tests.
 */
export function getElectronAppExecutablePath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin':
      return `./dist-electron/${getMacArchFolder()}/Tearleads.app/Contents/MacOS/Tearleads`;
    case 'win32':
      return './dist-electron/win-unpacked/Tearleads.exe';
    case 'linux':
      // Linux executable is named after the package name, not productName
      return './dist-electron/linux-unpacked/tearleads-frontend';
    default:
      throw new Error(`Unsupported platform: ${currentPlatform}`);
  }
}

/**
 * Get the Electron app bundle/directory path for file system checks.
 * Returns the path to the app bundle/directory (not the executable itself).
 */
export function getElectronAppBundlePath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin':
      return `./dist-electron/${getMacArchFolder()}/Tearleads.app`;
    case 'win32':
      return './dist-electron/win-unpacked';
    case 'linux':
      // For AppImage, the "bundle" is the executable file itself.
      return './dist-electron/linux-unpacked/tearleads-frontend';
    default:
      throw new Error(`Unsupported platform: ${currentPlatform}`);
  }
}
