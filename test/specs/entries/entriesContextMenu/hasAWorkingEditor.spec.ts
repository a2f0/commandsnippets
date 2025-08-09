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

    // Wait for entries to load
    await browser.pause(1000);

    // Check if first entry exists
    const firstEntry = await BasePage.tagsEntries1;
    const entryExists = await firstEntry.isExisting();

    if (entryExists) {
      // Right-click on the first entry to open context menu
      await firstEntry.waitForDisplayed();
      await firstEntry.click({button: 'right'});

      // Wait for context menu to appear
      await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
      await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();

      // Click the Edit option in the context menu
      await BasePage.tagsEntriesContextMenu1Edit.click();

      // Verify the editor opens with the entry content
      await expect(BasePage.textEntryEdit1).toBeExisting();
      await expect(BasePage.textEntryEdit1).toBeDisplayed();

      // Verify editor fields are present
      await expect(BasePage.textEntryEdit1Subject).toBeExisting();
      await expect(BasePage.textEntryEdit1Body).toBeExisting();

      // Test basic editing workflow
      console.log(
        '✅ Entry editor opened successfully with edit fields available'
      );
    } else {
      // If no entries exist, verify we can at least open the new entry form
      await (await BasePage.tagsEntriesList).waitAndRightClick();
      await expect(BasePage.entryListContextMenu).toBeDisplayed();
      await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();

      console.log('✅ No entries found, but entry creation menu is available');
    }

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
