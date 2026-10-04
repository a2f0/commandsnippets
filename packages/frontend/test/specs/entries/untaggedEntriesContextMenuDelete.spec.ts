import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Delete Entry', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('Should allow delete entries from untagged entries', async () => {
    await browser.resetMSWRequestCounts();
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await BasePage.checkTagsAndEntries();

    console.log('MSW API check:', apiCheck);
    expect(apiCheck.tagsOk).toBe(true);
    expect(apiCheck.entriesOk).toBe(true);
    expect(apiCheck.tagsCount).toBe(4); // MSW provides 4 tags
    expect(apiCheck.entriesCount).toBe(3); // MSW provides 3 entries

    await browser.login();
    await BasePage.open('test/test-tag-1');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Wait for content to load

    await expect(BasePage.tags).toBeElementsArrayOfSize(4);

    // Navigate directly to untagged entries (skip checking entries in tag view)
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await BasePage.entriesMenuButton.waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await BasePage.entriesMenuUntagged.waitAndLeftClick();
    await expect(browser).toHaveUrl(
      'http://localhost:8081/test?entries=untagged'
    );

    // Wait for untagged entries view to load fully

    // Check that we have the entries list displayed
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // The context menu of entry 3, the one in no tag: rendered only once it
    // is opened.
    await expect(BasePage.tagsEntryContextMenu('3')).not.toBeExisting();
    await BasePage.tagsEntry('3').waitAndRightClick();
    await expect(BasePage.tagsEntryContextMenu('3')).toBeDisplayed();
    await expect(BasePage.tagsEntryContextMenuDelete('3')).toBeDisplayed();

    // In untagged view, untag option should not be displayed
    await expect(BasePage.tagsEntryContextMenuUntag('3')).not.toBeDisplayed();

    // Get the initial delete count before clicking
    const initialDeleteCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/entries/3'
    );

    // Click the delete button to actually delete the entry
    await BasePage.tagsEntryContextMenuDelete('3').waitAndLeftClick();

    // Wait for the delete request to complete
    await browser.waitUntil(
      async () =>
        (await browser.getMSWRequestCount(
          'DELETE',
          'http://localhost:9001/api/v1/entries/3'
        )) > initialDeleteCount,
      {
        timeout: 5000,
        timeoutMsg:
          'Expected DELETE request count to increase after clicking delete',
      }
    );

    // Verify the DELETE request was made after clicking
    const finalDeleteCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/entries/3'
    );

    // One DELETE for the entry. (The request counter used to count URLs
    // without a query twice, which read as two requests here.)
    const newRequests = finalDeleteCount - initialDeleteCount;
    expect(newRequests).toBe(1);

    // Verify the entry is removed from the DOM
    await expect(BasePage.tagsEntry('3')).not.toBeDisplayed();

    // Test core functionality: entry delete completed successfully
    console.log('OK: Entry deleted successfully from untagged entries view');

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
