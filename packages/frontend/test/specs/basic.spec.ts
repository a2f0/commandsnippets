import {BasePage} from '../pageobjects/base';

describe('Page Behavior', () => {
  it('should load', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
