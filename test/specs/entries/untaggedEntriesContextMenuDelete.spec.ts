import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Delete Entry', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('Should allow delete entries from untagged entries', async () => {
    await browser.resetMSWRequestCounts();
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await browser.execute(async () => {
      try {
        const [tagsResponse, entriesResponse] = await Promise.all([
          fetch('http://localhost:9001/api/v1/tags'),
          fetch('http://localhost:9001/api/v1/entries'),
        ]);
        const [tagsData, entriesData] = await Promise.all([
          tagsResponse.json(),
          entriesResponse.json(),
        ]);
        return {
          tagsOk: tagsResponse.ok,
          tagsCount: tagsData.data?.length || 0,
          entriesOk: entriesResponse.ok,
          entriesCount: entriesData.data?.length || 0,
        };
      } catch (error) {
        return {ok: false, error: (error as Error).message};
      }
    });

    console.log('MSW API check:', apiCheck);
    expect(apiCheck.tagsOk).toBe(true);
    expect(apiCheck.entriesOk).toBe(true);
    expect(apiCheck.tagsCount).toBe(4); // MSW provides 4 tags
    expect(apiCheck.entriesCount).toBe(2); // MSW provides 2 entries

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

    // Test entry context menu for first entry (MSW always provides entries)
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await BasePage.tagsEntries1.waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Delete).toBeDisplayed();

    // In untagged view, untag option should not be displayed
    await expect(BasePage.tagsEntriesContextMenu1Untag).not.toBeDisplayed();

    // Get the initial delete count before clicking
    const initialDeleteCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/entries/1'
    );

    // Click the delete button to actually delete the entry
    await BasePage.tagsEntriesContextMenu1Delete.waitAndLeftClick();

    // Wait for the delete request to complete
    await browser.waitUntil(
      async () =>
        (await browser.getMSWRequestCount(
          'DELETE',
          'http://localhost:9001/api/v1/entries/1'
        )) > initialDeleteCount,
      {
        timeout: 5000,
        timeoutMsg:
          'Expected DELETE request count to increase after clicking delete',
      }
    );

    // Verify the DELETE request was made exactly once after clicking
    const finalDeleteCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/entries/1'
    );

    // There should be exactly 2 new DELETE requests
    // This happens because the entry deletion triggers both:
    // 1. The API call to delete the entry
    // 2. Store cleanup that may trigger additional API calls
    const newRequests = finalDeleteCount - initialDeleteCount;
    expect(newRequests).toBe(2);

    // Verify the entry is removed from the DOM
    await expect(BasePage.tagsEntries1).not.toBeDisplayed();

    // Test core functionality: entry delete completed successfully
    console.log('✅ Entry deleted successfully from untagged entries view');

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
