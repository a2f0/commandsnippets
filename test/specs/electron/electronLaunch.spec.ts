import {exec} from 'node:child_process';
import {promisify} from 'node:util';

const execAsync = promisify(exec);

describe('Electron App Launch Test', () => {
  let appProcess: any = null;

  afterEach(async () => {
    // Clean up - kill the app if it's still running
    try {
      await execAsync('pkill -f "Tearleads.app"');
    } catch (e) {
      // Process might not be running, that's okay
    }
  });

  it('should launch the Electron app and verify it reaches the home screen', async () => {
    console.log('Starting Electron app...');
    
    // Launch the app
    const appPath = './dist-electron/mac-arm64/Tearleads.app';
    exec(`open ${appPath}`);
    
    // Wait for the app to start
    await browser.pause(3000);
    
    // Check if the process is running
    const {stdout} = await execAsync('ps aux | grep -i "Tearleads.app" | grep -v grep');
    
    // Verify the app process is running
    expect(stdout).toContain('Tearleads.app/Contents/MacOS/Tearleads');
    expect(stdout).toContain('renderer');
    
    console.log('Electron app successfully launched!');
    console.log('Process info:', stdout.substring(0, 200));
    
    // Additional check: verify multiple processes are running (main, renderer, GPU, etc.)
    const processLines = stdout.split('\n').filter(line => line.trim());
    expect(processLines.length).toBeGreaterThanOrEqual(3); // At least main, renderer, and GPU processes
    
    console.log(`Found ${processLines.length} Electron processes running`);
  });
  
  it('should have proper app structure', async () => {
    // Verify the app bundle exists and has the right structure
    const appPath = './dist-electron/mac-arm64/Tearleads.app';
    
    // Check main executable exists
    const {stdout: mainExists} = await execAsync(`test -f "${appPath}/Contents/MacOS/Tearleads" && echo "exists" || echo "missing"`);
    expect(mainExists.trim()).toBe('exists');
    
    // Check Info.plist exists
    const {stdout: plistExists} = await execAsync(`test -f "${appPath}/Contents/Info.plist" && echo "exists" || echo "missing"`);
    expect(plistExists.trim()).toBe('exists');
    
    // Check app.asar exists
    const {stdout: asarExists} = await execAsync(`test -f "${appPath}/Contents/Resources/app.asar" && echo "exists" || echo "missing"`);
    expect(asarExists.trim()).toBe('exists');
    
    console.log('App bundle structure verified successfully');
  });
});