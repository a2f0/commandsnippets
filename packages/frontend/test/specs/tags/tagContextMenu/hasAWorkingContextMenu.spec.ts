import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('has a working context menu', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await BasePage.checkTagsAndEntries();

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

    // The tag's context menu is rendered only once it is opened.
    await expect(BasePage.tagContextMenu1).not.toBeExisting();

    // Test right-click interaction on tag-1
    await BasePage.tag1.waitAndRightClick();

    // Verify context menu becomes visible after right-click
    await expect(BasePage.tagContextMenu1).toBeDisplayed();

    // Test Escape key behavior - should hide the context menu
    await browser.keys('Escape');

    // Verify context menu is hidden again after Escape
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
