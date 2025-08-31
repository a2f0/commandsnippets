import {$$, browser, driver, expect} from '@wdio/globals';

describe('Android App Launch', () => {
  // App state constants for readability
  const APP_STATE_FOREGROUND = 4;
  const APP_PACKAGE = 'com.tearleads.app';

  it('should launch the app successfully', async () => {
    // The app should be automatically launched when the session starts
    console.log('Testing app launch...');

    // Use app package constant
    await browser.waitUntil(
      async () => {
        const appState = await driver.queryAppState(APP_PACKAGE);
        return appState === APP_STATE_FOREGROUND;
      },
      {
        timeout: 15000,
        timeoutMsg: 'App did not start within 15 seconds',
      }
    );

    // Take a screenshot to verify the app loaded
    await browser.saveScreenshot('./logs/screenshots/app-launch.png');

    // Verify the app is running by checking if we can get the app state
    const appState = await driver.queryAppState(APP_PACKAGE);
    console.log('App state:', appState);

    // App state should be 4 (running in foreground) for Android
    // See: https://appium.io/docs/en/commands/device/app/query-app-state/
    expect(appState).toBe(APP_STATE_FOREGROUND);
  });

  it('should display the main interface', async () => {
    // Wait for UI elements to load using explicit wait
    await browser.waitUntil(
      async () => {
        try {
          const elements = await $$('*');
          return Array.isArray(elements) && elements.length > 0;
        } catch {
          return false;
        }
      },
      {
        timeout: 10000,
        timeoutMsg: 'UI elements did not load within 10 seconds',
      }
    );

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
    await browser.waitUntil(
      async () => {
        try {
          const elements = await $$('*');
          return Array.isArray(elements) && elements.length > 0;
        } catch {
          return false;
        }
      },
      {
        timeout: 8000,
        timeoutMsg:
          'App did not become ready for touch interaction within 8 seconds',
      }
    );

    try {
      // Try to tap somewhere on the screen (center)
      const screenSize = await driver.getWindowSize();
      const centerX = screenSize.width / 2;
      const centerY = screenSize.height / 2;

      // Android uses a different touch action format
      await driver
        .action('pointer', {
          parameters: {pointerType: 'touch'},
        })
        .move({x: centerX, y: centerY})
        .down()
        .up()
        .perform();

      // Wait for any potential UI changes after touch using explicit wait
      await browser.waitUntil(
        async () => {
          // Simple check that the app is still responsive after touch
          const appState = await driver.queryAppState(APP_PACKAGE);
          return appState === APP_STATE_FOREGROUND;
        },
        {
          timeout: 3000,
          timeoutMsg: 'App did not remain responsive after touch interaction',
        }
      );

      // Take a screenshot after the interaction
      await browser.saveScreenshot('./logs/screenshots/after-tap.png');

      // If we get here without errors, the app is considered responsive to touch
      // The test validates that no errors are thrown during touch interaction
    } catch (error) {
      console.error('Touch interaction failed:', error);
      await browser.saveScreenshot('./logs/screenshots/touch-error.png');

      // This is a basic example. You might need more specific error checking
      // based on the types of errors Appium/WebDriverIO can throw.
      // For instance, if 'error' is an instance of a specific WebDriverIO error
      // that indicates a non-critical UI issue vs. a critical driver issue.
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('no such element') ||
        errorMessage.includes('element not interactable')
      ) {
        console.warn(
          'Touch interaction test failed due to non-critical issue (e.g., no interactive element at center). This might be expected for some app states.'
        );
      } else {
        // Re-throw for critical errors like driver issues, network problems, etc.
        console.error(
          'Critical touch interaction error. Re-throwing to fail the test.'
        );
        throw error;
      }
    }
  });

  it('should handle app background and foreground', async () => {
    console.log('Testing app background/foreground...');

    // Background the app for 2 seconds
    await driver.background(2);

    // Wait for app to return to foreground using explicit wait
    await browser.waitUntil(
      async () => {
        const appState = await driver.queryAppState(APP_PACKAGE);
        return appState === APP_STATE_FOREGROUND;
      },
      {
        timeout: 5000,
        timeoutMsg: 'App did not return to foreground within 5 seconds',
      }
    );

    // Verify app is back in foreground
    const appState = await driver.queryAppState(APP_PACKAGE);
    expect(appState).toBe(APP_STATE_FOREGROUND);

    await browser.saveScreenshot('./logs/screenshots/after-background.png');
  });
});
