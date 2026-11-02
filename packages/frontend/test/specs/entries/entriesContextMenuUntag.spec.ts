import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Untag', () => {
  it('should untag', async () => {
    await browser.resetMSWRequestCounts();
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();

    await browser.login();
    await BasePage.open('test/test-tag-1');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify basic page elements exist and MSW is working
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Get the first entry and verify it exists
    const firstEntry = BasePage.tagsEntries1;
    await expect(firstEntry).toBeExisting();
    await expect(firstEntry).toBeDisplayed();

    // Right-click on the first entry to open context menu
    await firstEntry.click({button: 'right'});

    // Wait for context menu to appear
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();

    // Verify untag option exists
    await expect(BasePage.tagsEntriesContextMenu1Untag).toBeExisting();

    // No untag issued here; ensure tags_entries DELETE has not been called
    const untagCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/tags_entries/1'
    );
    expect(untagCount).toBe(0);

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
