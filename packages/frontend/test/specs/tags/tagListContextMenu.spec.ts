import {BasePage} from '../../pageobjects/base';

describe('Tag List Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
    await BasePage.signIn('');

    // Ensure tag list UI is present
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();

    // Open context menu via right-click
    await BasePage.tagList.waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();

    // Close with Escape
    await browser.keys('Escape');
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
