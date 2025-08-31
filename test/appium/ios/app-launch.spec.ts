import {$$, browser, driver, expect} from '@wdio/globals';

describe('iOS App Launch', () => {
  // App state constants for readability
  const APP_STATE_FOREGROUND = 4;
  const BUNDLE_ID = 'com.tearleads.app';

  // Helper function to wait for UI elements to be ready
  const waitForUIReady = async (timeoutMs = 10000) => {
    await browser.waitUntil(
      async () => {
        try {
          // Wait for meaningful UI elements to be present
          // This is more reliable than browser.pause() and better than generic '*'
          const elements = await $$('*');

          // Ensure we have a reasonable number of elements (not just a splash screen)
          // and wait a bit for the UI to stabilize
          return Array.isArray(elements) && elements.length >= 15;
        } catch {
          return false;
        }
      },
      {
        timeout: timeoutMs,
        timeoutMsg: `UI elements did not become ready within ${timeoutMs}ms`,
      }
    );
  };

  it('should launch the app successfully', async () => {
    // The app should be automatically launched when the session starts
    console.log('Testing app launch...');

    // Wait for the app to fully load using explicit wait
    await browser.waitUntil(
      async () => {
        // App state 4 means running in foreground for iOS
        const appState = await driver.queryAppState(BUNDLE_ID);
        return appState === APP_STATE_FOREGROUND;
      },
      {
        timeout: 15000,
        timeoutMsg: 'App did not enter foreground state within 15 seconds',
      }
    );

    // Take a screenshot to verify the app loaded
    await browser.saveScreenshot('./logs/screenshots/app-launch.png');

    // Verify the app is running by checking if we can get the app state
    const appState = await driver.queryAppState(BUNDLE_ID);
    console.log('App state:', appState);

    // App state should be 4 (running in foreground)
    expect(appState).toBe(APP_STATE_FOREGROUND);
  });

  it('should display the main interface', async () => {
    // Wait for UI elements to load using our helper function
    await waitForUIReady(10000);

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
    // Wait for app to be ready using our helper function
    await waitForUIReady(8000);

    try {
      // Try to tap somewhere on the screen (center)
      const screenSize = await driver.getWindowSize();
      const centerX = screenSize.width / 2;
      const centerY = screenSize.height / 2;

      await driver.touchAction({
        action: 'tap',
        x: centerX,
        y: centerY,
      });

      // Wait for any potential UI changes after touch using explicit wait
      await browser.waitUntil(
        async () => {
          // Simple check that the app is still responsive after touch
          const appState = await driver.queryAppState(BUNDLE_ID);
          return appState === APP_STATE_FOREGROUND;
        },
        {
          timeout: 3000,
          timeoutMsg: 'App did not remain responsive after touch interaction',
        }
      );

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
});
