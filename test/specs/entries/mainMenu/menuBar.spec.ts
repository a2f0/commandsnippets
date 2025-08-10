import {BasePage} from '../../../pageobjects/base';

describe('Entry Main Menu', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should having a working menu bar', async () => {
    await browser.resetMSWRequestCounts();
    // Navigate to page first, then login (using MSW)
    await BasePage.open('');
    await browser.login();
    await BasePage.open('');
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    // Assert initial GETs occurred
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
    await browser.keys('Escape');
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
