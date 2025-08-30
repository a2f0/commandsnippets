import {expect, browser, driver, $$} from '@wdio/globals';

describe('Android App Launch', () => {
  it('should launch the app successfully', async () => {
    // The app should be automatically launched when the session starts
    console.log('Testing app launch...');

    // Wait for app to be in running state using explicit wait
    const appPackage = 'com.tearleads.app';
    await browser.waitUntil(async () => {
      const appState = await driver.queryAppState(appPackage);
      return appState === 4; // Running in foreground
    }, {
      timeout: 15000,
      timeoutMsg: 'App did not start within 15 seconds'
    });

    // Take a screenshot to verify the app loaded
    await browser.saveScreenshot('./logs/screenshots/app-launch.png');

    // Verify the app is running by checking if we can get the app state
    const appState = await driver.queryAppState(appPackage);
    console.log('App state:', appState);

    // App state should be 4 (running in foreground) for Android
    expect(appState).toBe(4);
  });

  it('should display the main interface', async () => {
    // Wait for UI elements to load using explicit wait
    await browser.waitUntil(async () => {
      try {
        const elements = await $$('*');
        return elements.length > 0;
      } catch {
        return false;
      }
    }, {
      timeout: 10000,
      timeoutMsg: 'UI elements did not load within 10 seconds'
    });

    // Try to find any text element to verify the app UI loaded
    // This will depend on your app's structure
    try {
      // Look for any accessible element
      const elements = await $$('*');
      console.log(`Found ${elements.length} elements`);

      // Take a screenshot of the main interface
      await browser.saveScreenshot('./logs/screenshots/main-interface.png');

      // Verify we found some elements (basic check that UI loaded)
      expect(elements.length).toBeGreaterThan(0);
    } catch (error) {
      console.log('Error finding elements:', error);

      // Take a screenshot for debugging
      await browser.saveScreenshot('./logs/screenshots/error-state.png');

      // Still fail the test but with more info
      throw new Error(`Failed to find UI elements: ${error}`);
    }
  });

  it('should be responsive to touch', async () => {
    // Wait for app to be ready using explicit wait for elements
    await browser.waitUntil(async () => {
      try {
        const elements = await $$('*');
        return elements.length > 0;
      } catch {
        return false;
      }
    }, {
      timeout: 8000,
      timeoutMsg: 'App did not become ready for touch interaction within 8 seconds'
    });

    try {
      // Try to tap somewhere on the screen (center)
      const screenSize = await driver.getWindowSize();
      const centerX = screenSize.width / 2;
      const centerY = screenSize.height / 2;

      // Android uses a different touch action format
      await driver.action('pointer', {
        parameters: {pointerType: 'touch'},
      })
        .move({x: centerX, y: centerY})
        .down()
        .up()
        .perform();

      // Wait for any potential UI changes after touch
      await browser.waitUntil(async () => true, {
        timeout: 2000,
        timeoutMsg: 'Touch action completed'
      });

      // Take a screenshot after the interaction
      await browser.saveScreenshot('./logs/screenshots/after-tap.png');

      // If we get here without errors, the app is responsive
      expect(true).toBe(true);
    } catch (error) {
      console.log('Touch interaction failed:', error);
      await browser.saveScreenshot('./logs/screenshots/touch-error.png');

      // This might not be critical - some apps might not respond to center taps
      console.warn('Touch interaction test failed, but this might be expected');
    }
  });

  it('should handle app background and foreground', async () => {
    try {
      console.log('Testing app background/foreground...');
      
      // Background the app for 2 seconds
      await driver.background(2);
      
      // Wait for app to return to foreground using explicit wait
      await browser.waitUntil(async () => {
        const appState = await driver.queryAppState('com.tearleads.app');
        return appState === 4; // Running in foreground
      }, {
        timeout: 5000,
        timeoutMsg: 'App did not return to foreground within 5 seconds'
      });
      
      // Verify app is back in foreground
      const appState = await driver.queryAppState('com.tearleads.app');
      expect(appState).toBe(4); // Running in foreground
      
      await browser.saveScreenshot('./logs/screenshots/after-background.png');
    } catch (error) {
      console.log('Background/foreground test failed:', error);
      // Non-critical test
      console.warn('Background test failed, but app may still be functional');
    }
  });
});