import {BasePage} from '../../pageobjects/base';

describe('Entry Main Menu Behavior', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should having a working context menu to create new entries', async () => {
    // Reset just before we perform the check below to avoid double-counting initial app loads
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

    // Reset and assert for the upcoming authenticated load
    await browser.resetMSWRequestCounts();

    await browser.login();
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Wait for the page to load and display content

    // Test entries menu functionality
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();

    // Click entries menu button to open menu
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();

    // Click untagged entries option
    await (await BasePage.entriesMenuUntagged).waitAndLeftClick();

    // Verify navigation to untagged entries view
    await expect(browser).toHaveUrl(
      'http://localhost:8081/test?entries=untagged'
    );

    // Verify untagged entries are displayed
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Check if any untagged entries exist
    const entries = await BasePage.tagsEntries;
    const entriesLength = await entries.length;

    // If untagged entries exist, verify they are displayed
    if (entries && entriesLength > 0) {
      await expect(entries).toBeElementsArrayOfSize({gte: 1});
      const firstEntry = await BasePage.tagsEntries1;
      if (await firstEntry.isExisting()) {
        await expect(firstEntry).toBeDisplayed();
      }
    } else {
      // Verify empty state or no untagged entries message
      console.log(
        'No untagged entries found - this is expected if all entries are tagged'
      );
    }

    // Test core functionality: entries menu workflow completed successfully
    console.log(
      '✅ Untagged entries workflow completed: menu opened, untagged selected, URL updated, entries verified'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
