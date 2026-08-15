import {BasePage} from '../../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  afterEach(async () => {
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

    // Verify that entries are listed
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize({gte: 2});

    // Check first entry exists and is displayed
    const firstEntry = BasePage.tagsEntries1;
    await expect(firstEntry).toBeExisting();
    await expect(firstEntry).toBeDisplayed();

    // Check second entry exists and is displayed
    const secondEntry = await $('#tagsEntries-2');
    await expect(secondEntry).toBeExisting();
    await expect(secondEntry).toBeDisplayed();

    console.log(
      'OK: Entry list test completed: entries are properly displayed for the tag'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
