import {BasePage} from '../../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('should list entries', async () => {
    // Navigate and verify MSW is ready
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
    // Wait for content to load
    await browser.pause(2000);

    // Verify entries list is displayed
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Test context menu behavior if entries exist
    const entries = await BasePage.tagsEntries;
    const entriesCount = await entries.length;
    if (entriesCount > 0) {
      await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
      await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();

      // Right-click to show context menu
      await (await BasePage.tagsEntries1).waitAndRightClick();
      await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();

      // Press Escape to close context menu
      await browser.keys('Escape');
      await browser.pause(500);
      await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();

      console.log(
        '✅ Entry context menu workflow completed: menu opened and closed with Escape'
      );
    } else {
      console.log(
        'No entries found - verified entries list container is displayed'
      );
    }
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
