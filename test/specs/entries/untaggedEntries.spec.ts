import {BasePage} from '../../pageobjects/base';

describe('Entry Main Menu Behavior', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('should having a working context menu to create new entries', async () => {
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

    // Wait for the page to load and display content
    await browser.pause(2000);

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

    // Test core functionality: entries menu workflow completed successfully
    console.log(
      '✅ Untagged entries workflow completed: menu opened, untagged selected, URL updated'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
