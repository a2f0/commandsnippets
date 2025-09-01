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
    } else if (currentPlatform === 'linux' || currentPlatform === 'win32') {
      // Check main executable exists
      expect(existsSync(appPath)).toBe(true);
    }

    console.log('App bundle structure verified successfully');
  });
});
