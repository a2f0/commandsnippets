import {BasePage} from '../../pageobjects/base';

describe("Another user's data", () => {
  it("lets staff read a user's data, read-only", async () => {
    await BasePage.signIn('admin');
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
