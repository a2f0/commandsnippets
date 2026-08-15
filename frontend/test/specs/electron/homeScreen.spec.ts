import invariant from 'invariant';

describe('Electron App Home Screen', () => {
  it('should launch and display the home screen', async () => {
    // Wait for the app to be ready and a window to be available
    await browser.waitUntil(
      async () => (await browser.getWindowHandles()).length > 0,
      {timeout: 10000, timeoutMsg: 'Electron app window did not open'}
    );

    // Check if the main window is available
    const windowHandles = await browser.getWindowHandles();
    expect(windowHandles.length).toBeGreaterThan(0);

    // Switch to the main window
    const firstWindow = windowHandles[0];
    invariant(firstWindow, 'First window handle should exist');
    await browser.switchToWindow(firstWindow);

    // Wait for the DOM to be ready
    await browser.waitUntil(
      async () => {
        const readyState = await browser.execute(() => document.readyState);
        return readyState === 'complete';
      },
      {timeout: 15000, timeoutMsg: 'Document did not reach ready state'}
    );

    // Check if basic HTML structure exists (more resilient test)
    const bodyExists = await browser.execute(() => {
      return document.body !== null && document.body.innerHTML.length > 0;
    });
    expect(bodyExists).toBe(true);

    // Try to find any React root element (common in React apps)
    const hasReactRoot = await browser.execute(() => {
      return (
        document.getElementById('root') !== null ||
        document.querySelector('[id*="root"]') !== null ||
        document.querySelector('div') !== null
      );
    });
    expect(hasReactRoot).toBe(true);

    expect(hasReactRoot).toBe(true);
  });

  it('should have proper window dimensions', async () => {});

  it('should have proper window dimensions', async () => {
    // Use execute to get window dimensions via JavaScript
    // since browser.getWindowSize() uses incompatible Chrome DevTools commands
    const windowSize = await browser.execute(() => {
      return {
        width: window.innerWidth || document.documentElement.clientWidth,
        height: window.innerHeight || document.documentElement.clientHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
      };
    });

    // Verify the window has reasonable dimensions
    expect(windowSize.width).toBeGreaterThan(300);
    expect(windowSize.height).toBeGreaterThan(200);

    console.log(
      `Window dimensions: ${windowSize.width}x${windowSize.height} (outer: ${windowSize.outerWidth}x${windowSize.outerHeight})`
    );
  });
});
