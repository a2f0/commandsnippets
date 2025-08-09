import {logOutPostResponse} from '../../mocks/authentication/logoutResponse';
import {entriesResponse} from '../../mocks/entries/entriesResponse';
import {tagsResponse} from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Logged Out User Behavior', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('should have different context menus for logged out users', async () => {
    // Navigate to page first, then login (using MSW)
    await BasePage.open('');
    await browser.login();
    await BasePage.open('');

    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    // Establish initial view - MSW provides 4 tags but entries count may vary
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.googleAuthButton).not.toBeExisting();
    await expect(BasePage.googleAuthButton).not.toBeDisplayed();
    await expect(BasePage.githubAuthButton).not.toBeExisting();
    await expect(BasePage.githubAuthButton).not.toBeDisplayed();
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.entryListContextMenu).toBeExisting();

    // Log out
    await expect(BasePage.fileMenu).toBeExisting();
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await BasePage.fileMenuButton.waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();
    await expect(BasePage.fileMenuLogout).toBeDisplayed();
    await BasePage.fileMenuLogout.waitAndLeftClick();

    // Confirm state after logout
    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.googleAuthButton).toBeExisting();
    await expect(BasePage.googleAuthButton).toBeDisplayed();
    await expect(BasePage.githubAuthButton).toBeExisting();
    await expect(BasePage.githubAuthButton).toBeDisplayed();
    await expect(BasePage.fileMenuButton).not.toBeDisplayed();
    await expect(BasePage.tagListContextMenu).not.toBeExisting();
    await expect(BasePage.entryListContextMenu).not.toBeExisting();

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
