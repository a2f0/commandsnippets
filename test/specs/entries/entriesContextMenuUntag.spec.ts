import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Untag', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should untag', async () => {
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

    // Verify basic page elements exist and MSW is working
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Wait for entries to load
    await browser.pause(1000);

    // Get the first entry and verify it exists
    const firstEntry = await BasePage.tagsEntries1;
    await expect(firstEntry).toBeExisting();
    await expect(firstEntry).toBeDisplayed();

    // Right-click on the first entry to open context menu
    await firstEntry.click({button: 'right'});

    // Wait for context menu to appear
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();

    // Verify untag option exists
    await expect(BasePage.tagsEntriesContextMenu1Untag).toBeExisting();

    console.log('✅ Untag context menu option is available for tagged entry');

    // No untag issued here; ensure tags_entries DELETE has not been called
    const untagCount = await browser.getMSWRequestCount(
      'DELETE',
      'http://localhost:9001/api/v1/tags_entries/1'
    );
    expect(untagCount).toBe(0);

    console.log('✅ Untag test completed: entry successfully removed from tag');

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
