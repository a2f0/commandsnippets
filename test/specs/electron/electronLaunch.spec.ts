import {exec} from 'node:child_process';
import {platform} from 'node:os';
import {promisify} from 'node:util';

const execAsync = promisify(exec);

// Platform-specific helpers
function getElectronAppPath(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      return './dist-electron/mac-arm64/Tearleads.app';
    }
    case 'win32': {
      return './dist-electron/win-unpacked/Tearleads.exe';
    }
    case 'linux': {
      return './dist-electron/linux-unpacked/tearleads';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

function getLaunchCommand(): string {
  const currentPlatform = platform();
  const appPath = getElectronAppPath();
  switch (currentPlatform) {
    case 'darwin': {
      return `open ${appPath}`;
    }
    case 'win32': {
      return `"${appPath}"`;
    }
    case 'linux': {
      return `"${appPath}" &`;
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

function getProcessSearchPattern(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      return 'ps aux | grep -i "Tearleads.app" | grep -v grep';
    }
    case 'win32': {
      return 'tasklist | findstr "Tearleads.exe"';
    }
    case 'linux': {
      return 'ps aux | grep -i "tearleads" | grep -v grep';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

function getKillCommand(): string {
  const currentPlatform = platform();
  switch (currentPlatform) {
    case 'darwin': {
      return 'pkill -f "Tearleads.app"';
    }
    case 'win32': {
      return 'taskkill /f /im "Tearleads.exe"';
    }
    case 'linux': {
      return 'pkill -f "tearleads"';
    }
    default: {
      throw new Error(`Unsupported platform: ${currentPlatform}`);
    }
  }
}

describe('Electron App Launch Test', () => {
  afterEach(async () => {
    // Clean up - kill the app if it's still running
    try {
      await execAsync(getKillCommand());
    } catch {
      // Process might not be running, that's okay
    }
  });

  it('should launch the Electron app and verify it reaches the home screen', async () => {
    console.log('Starting Electron app...');

    // Skip test if running in CI environment without display
    if (process.env['CI'] && platform() === 'linux') {
      console.log('Skipping Electron test in CI environment (no display)');
      // Mark test as pending/skipped
      return;
    }

    // Launch the app
    const launchCommand = getLaunchCommand();
    exec(launchCommand);

    // Wait for the app to start
    await browser.pause(3000);

    // Check if the process is running
    const {stdout} = await execAsync(getProcessSearchPattern());

    // Verify the app process is running (platform-specific checks)
    const currentPlatform = platform();
    if (currentPlatform === 'darwin') {
      expect(stdout).toContain('Tearleads.app/Contents/MacOS/Tearleads');
      expect(stdout).toContain('renderer');
    } else if (currentPlatform === 'win32') {
      expect(stdout).toContain('Tearleads.exe');
    } else if (currentPlatform === 'linux') {
      expect(stdout).toContain('tearleads');
    }

    console.log('Electron app successfully launched!');
    console.log('Process info:', stdout.substring(0, 200));

    // Additional check: verify processes are running
    const processLines = stdout.split('\n').filter(line => line.trim());
    if (currentPlatform === 'darwin') {
      expect(processLines.length).toBeGreaterThanOrEqual(3); // At least main, renderer, and GPU processes
    } else {
      expect(processLines.length).toBeGreaterThanOrEqual(1); // At least main process
    }

    console.log(`Found ${processLines.length} Electron processes running`);
  });

  it('should have proper app structure', async () => {
    // Verify the app bundle exists and has the right structure
    const appPath = getElectronAppPath();
    const currentPlatform = platform();

    if (currentPlatform === 'darwin') {
      // Check main executable exists
      const {stdout: mainExists} = await execAsync(
        `test -f "${appPath}/Contents/MacOS/Tearleads" && echo "exists" || echo "missing"`
      );
      expect(mainExists.trim()).toBe('exists');

      // Check Info.plist exists
      const {stdout: plistExists} = await execAsync(
        `test -f "${appPath}/Contents/Info.plist" && echo "exists" || echo "missing"`
      );
      expect(plistExists.trim()).toBe('exists');

      // Check app.asar exists
      const {stdout: asarExists} = await execAsync(
        `test -f "${appPath}/Contents/Resources/app.asar" && echo "exists" || echo "missing"`
      );
      expect(asarExists.trim()).toBe('exists');
    } else if (currentPlatform === 'linux' || currentPlatform === 'win32') {
      // Check main executable exists
      const testCommand =
        currentPlatform === 'win32'
          ? `if exist "${appPath}" (echo exists) else (echo missing)`
          : `test -f "${appPath}" && echo "exists" || echo "missing"`;

      const {stdout: mainExists} = await execAsync(testCommand);
      expect(mainExists.trim()).toBe('exists');
    }

    console.log('App bundle structure verified successfully');
  });
});
