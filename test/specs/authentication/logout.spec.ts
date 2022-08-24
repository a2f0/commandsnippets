import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import logoutResponse from '../../mocks/authentication/logoutResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Logged Out User Behavior', () => {
  it('should have different context menus for logged out users', async () => {
    const mostEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    const mockLogoutOptionsResponse = await browser.mock(
      'http://localhost:9001/api-token-deauth**',
      {
        method: 'options',
      }
    );
    const mockLogoutResponse = await browser.mock(
      'http://localhost:9001/api-token-deauth**',
      {
        method: 'post',
      }
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mostEntriesResponse.respond(entriesResponse, {fetchResponse: false});
    mockLogoutOptionsResponse.respond({fetchResponse: false});
    mockLogoutResponse.respond(logoutResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
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
    await (await BasePage.fileMenuButton).waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();
    await expect(BasePage.fileMenuLogout).toBeDisplayed();
    await expect(mockLogoutResponse).toBeRequestedTimes(0);
    await (await BasePage.fileMenuLogout).waitAndLeftClick();
    await expect(mockLogoutResponse).toBeRequestedTimes(1);

    // Confirm state after logout
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.googleAuthButton).toBeExisting();
    await expect(BasePage.googleAuthButton).toBeDisplayed();
    await expect(BasePage.githubAuthButton).toBeExisting();
    await expect(BasePage.githubAuthButton).toBeDisplayed();
    await expect(BasePage.fileMenuButton).not.toBeDisplayed();
    await expect(BasePage.tagListContextMenu).not.toBeExisting();
    await expect(BasePage.entryListContextMenu).not.toBeExisting();
  });
});
