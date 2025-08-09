import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('has a working context menu', async () => {
    // Navigate and verify MSW is ready
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await browser.execute(async () => {
      try {
        const [tagsResponse, entriesResponse] = await Promise.all([
          fetch('http://localhost:9001/api/v1/tags'),
          fetch('http://localhost:9001/api/v1/entries')
        ]);
        const [tagsData, entriesData] = await Promise.all([
          tagsResponse.json(),
          entriesResponse.json()
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

    await browser.login();
    await BasePage.open('');
    // Verify tag list and individual tags are present
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();

    // Verify we have all 4 tags from MSW
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);

    // Verify tag context menu exists but is initially hidden
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();

    // Test right-click interaction on tag-1
    await (await BasePage.tag1).waitAndRightClick();

    // Verify context menu becomes visible after right-click
    await expect(BasePage.tagContextMenu1).toBeDisplayed();

    // Test Escape key behavior - should hide the context menu
    await browser.keys('Escape');

    // Verify context menu is hidden again after Escape
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
