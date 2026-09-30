import {BasePage} from '../pageobjects/base';

describe('Page Behavior', () => {
  it('should load', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await expect(BasePage.signInPage.$('h1')).toHaveText('Login to Continue');
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
