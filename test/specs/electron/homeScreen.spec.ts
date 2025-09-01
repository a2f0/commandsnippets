describe('Electron App Home Screen', () => {
  it('should launch and display the home screen', async () => {
    // Wait for the app to be ready
    await browser.pause(2000);
    
    // Check if the main window is available
    const windowHandles = await browser.getWindowHandles();
    expect(windowHandles.length).toBeGreaterThan(0);
    
    // Switch to the main window if needed
    if (windowHandles.length > 0) {
      await browser.switchToWindow(windowHandles[0]);
    }
    
    // Wait for the app to load and check for the main elements
    // The tagLine element is a consistent element in the app
    const tagLine = await $('[data-testid="tagLine"]');
    await tagLine.waitForDisplayed({
      timeout: 10000,
      timeoutMsg: 'Home screen did not load within 10 seconds',
    });
    
    // Verify the tag line is displayed
    await expect(tagLine).toBeDisplayed();
    
    // Check for other key home screen elements
    // Tag list container
    const tagList = await $('.tagList');
    await expect(tagList).toBeExisting();
    
    // Entry list container  
    const entryList = await $('.entryList');
    await expect(entryList).toBeExisting();
    
    // Verify the app title or header if present
    const appTitle = await $('h1');
    if (await appTitle.isExisting()) {
      const titleText = await appTitle.getText();
      expect(titleText).toBeTruthy();
    }
    
    console.log('Electron app successfully loaded the home screen');
  });
  
  it('should have proper window dimensions', async () => {
    // Get the window size
    const windowSize = await browser.getWindowSize();
    
    // Verify the window has reasonable dimensions
    expect(windowSize.width).toBeGreaterThan(600);
    expect(windowSize.height).toBeGreaterThan(400);
    
    console.log(`Window dimensions: ${windowSize.width}x${windowSize.height}`);
  });
});