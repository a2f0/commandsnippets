import {BasePage} from '../../pageobjects/base';

describe("Another user's data", () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it("lets staff read a user's data, read-only", async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await browser.login();
    await BasePage.open('admin');
    await expect(BasePage.adminUserRow('7')).toBeDisplayed();

    await BasePage.adminUserMenuButton('7').waitAndLeftClick();
    await BasePage.adminUserMenuViewData.waitAndLeftClick();

    await expect(BasePage.readOnlyBadge).toHaveText('Read-only: alice');
    await expect($('#tagList')).toHaveText(
      expect.stringContaining('alices-tag')
    );
    await expect($('#tagsEntriesList')).toHaveText(
      expect.stringContaining('alices-entry')
    );
    await expect(browser).toHaveUrl(expect.stringContaining('/alice/'));

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
