import {BasePage} from '../../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('should list entries', async () => {
    // Navigate to page first, then login (exactly like search test)
    await BasePage.open('');
    await browser.login();
    await expect(BasePage.tagLine).toBeDisplayed();
    
    // Navigate to the tag page
    await BasePage.open('test/test-tag-1');

    // Verify we're on the correct tag page
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify basic page elements exist
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    console.log(
      '✅ Entry list navigation completed: tag-specific page loaded successfully'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
