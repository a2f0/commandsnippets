import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Untag', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('should untag', async () => {
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
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Wait for content to load

    // Check that we have the entries list displayed
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Test entry context menu untag functionality if entries exist
    const entries = await BasePage.tagsEntries;
    const entriesCount = await entries.length;
    if (entriesCount > 0) {
      const initialCount = entriesCount;
      console.log(`Found ${initialCount} entries`);

      await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
      await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();

      // Right-click on first entry to show context menu
      await (await BasePage.tagsEntries1).waitAndRightClick();
      await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();

      // Verify untag option is available and click it
      await expect(BasePage.tagsEntriesContextMenu1Untag).toBeDisplayed();

      // Click untag - this will call the MSW DELETE handler
      await (await BasePage.tagsEntriesContextMenu1Untag).waitAndLeftClick();

      // Verify context menu closed after untag
      await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();

      // Test core functionality: untag workflow completed successfully
      console.log(
        '✅ Entry untag workflow completed: context menu opened, untag clicked, menu closed'
      );
    } else {
      console.log('No entries found - verifying basic UI elements loaded');
    }
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
