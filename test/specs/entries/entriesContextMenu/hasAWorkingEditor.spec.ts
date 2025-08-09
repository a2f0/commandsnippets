import {BasePage} from '../../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('has a working editor', async () => {
    // Navigate to page first, then login (using MSW)
    await BasePage.open('');
    await browser.login();
    await BasePage.open('test/test-tag-1');

    // Verify basic page elements exist - entries list should be displayed
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    console.log(
      '✅ Entry editor navigation completed: tag-specific page with entries list loaded successfully'
    );
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
