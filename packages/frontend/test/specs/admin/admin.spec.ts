import {BasePage} from '../../pageobjects/base';

describe('Admin page', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('lets staff deactivate a user and see it in the audit log', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await browser.login();
    await BasePage.open('admin');

    // /admin is the admin page, not the page of a user named "admin".
    await expect(BasePage.adminPage).toBeDisplayed();
    await expect(BasePage.adminUserRow('7')).toHaveText(
      expect.stringContaining('alice@example.com')
    );
    // Staff get the mode tabs once the page has confirmed their access.
    await expect(BasePage.adminModeTab).toHaveAttribute(
      'aria-selected',
      'true'
    );
    // Their own account cannot be deactivated.
    await expect(BasePage.adminUserToggle('1')).toBeDisabled();

    await BasePage.adminUserToggle('7').waitAndLeftClick();
    await BasePage.adminConfirmButton.waitAndLeftClick();
    await expect(BasePage.adminUserToggle('7')).toHaveText('Reactivate');
    await browser.toBeRequestedTimes(
      'PATCH',
      'http://localhost:9001/api/v1/admin/users/7',
      1
    );

    await BasePage.adminAuditLogTab.waitAndLeftClick();
    await expect(BasePage.adminAuditLog).toHaveText(
      expect.stringContaining('alice')
    );

    // The User tab switches back to the app as any user sees it.
    await BasePage.userModeTab.waitAndLeftClick();
    await expect(BasePage.adminPage).not.toBeDisplayed();
    await expect(BasePage.userModeTab).toHaveAttribute('aria-selected', 'true');
    await BasePage.adminModeTab.waitAndLeftClick();
    await expect(BasePage.adminPage).toBeDisplayed();

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
