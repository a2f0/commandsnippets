import {existsSync} from 'node:fs';
import {platform} from 'node:os';
import {join} from 'node:path';
import {getElectronAppBundlePath} from '../../util/electronTestUtils';

describe('Electron App Bundle Test', () => {
  it('should have proper app structure', async () => {
    // Verify the app bundle exists and has the right structure
    const appPath = getElectronAppBundlePath();
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      // Check main executable exists
      expect(existsSync(join(appPath, 'Contents/MacOS/Tearleads'))).toBe(true);

      // Check Info.plist exists
      expect(existsSync(join(appPath, 'Contents/Info.plist'))).toBe(true);

      // Check app.asar exists
      expect(existsSync(join(appPath, 'Contents/Resources/app.asar'))).toBe(
        true
      );
    } else if (currentPlatform === 'win32') {
      // Check bundle directory exists
      expect(existsSync(appPath)).toBe(true);

      // Check main executable exists within the bundle directory
      expect(existsSync(join(appPath, 'Tearleads.exe'))).toBe(true);
    } else if (currentPlatform === 'linux') {
      // Check main executable exists (for Linux, bundle path is the executable itself)
      expect(existsSync(appPath)).toBe(true);
    }
  });
});
