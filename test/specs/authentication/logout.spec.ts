import {logOutPostResponse} from '../../mocks/authentication/logoutResponse';
import {entriesResponse} from '../../mocks/entries/entriesResponse';
import {tagsResponse} from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Logged Out User Behavior', () => {
  it.skip('should have different context menus for logged out users', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    const mockEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntriesResponse.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tagsResponse);

    const mockLogoutResponse = await browser.mock(
      'http://localhost:9001/api-token-deauth*',
      {method: 'POST'}
    );
    mockLogoutResponse.respond(logOutPostResponse);

    await browser.login();
    await BasePage.open('');

    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    // Establish initial view
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
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
    expect(mockLogoutResponse).toBeRequestedTimes(0);
    await BasePage.fileMenuLogout.waitAndLeftClick();
    expect(mockLogoutResponse).toBeRequestedTimes(1);

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
