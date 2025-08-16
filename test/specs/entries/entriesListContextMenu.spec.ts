import {BasePage} from '../../pageobjects/base';

describe('Entry Main Menu Behavior', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should having a working context menu to create new entries', async () => {
    // Navigate to page first, then login (using MSW)
    await BasePage.open('');
    await browser.login();
    // Reset counters right before the navigational load we want to assert
    await browser.resetMSWRequestCounts();
    await BasePage.open('');

    // Verify basic page elements exist and MSW is working
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.entryListContextMenu).not.toBeDisplayed();

    // Test right-click context menu functionality
    await BasePage.tagsEntriesList.waitAndRightClick();
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();

    // Close context menu with escape
    await browser.keys('Escape');
    await expect(BasePage.entryListContextMenu).not.toBeDisplayed();

    // Test opening new entry form
    await BasePage.tagsEntriesList.waitAndRightClick();
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await BasePage.entryListContextMenuNewEntry.waitAndLeftClick();
    await expect(BasePage.entryNewBottom).toBeDisplayed();

    // Test basic form functionality - focus and input
    await expect(BasePage.entryNewBottomSubject).toBeFocused();
    await browser.keys('Test Subject');
    expect(BasePage.entryNewBottomSubject).toHaveValue('Test Subject');

    await BasePage.entryNewBottomBody.waitAndLeftClick();
    await expect(BasePage.entryNewBottomBody).toBeFocused();
    await browser.keys('Test Body Content');
    expect(BasePage.entryNewBottomBody).toHaveValue('Test Body Content');

    console.log(
      '✅ Entry context menu test completed: all basic MSW-integrated functionality verified'
    );

    // Assert initial GETs occurred for this page load
    await browser.toBeRequestedTimes(
      'GET',
      'http://localhost:9001/api/v1/tags',
      1
    );
    await browser.toBeRequestedTimes(
      'GET',
      'http://localhost:9001/api/v1/entries',
      1
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
