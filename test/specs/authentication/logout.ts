import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
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
    assert.strictEqual(
      await browser.getUrl(),
      'http://localhost:8081/test/test'
    );
    await expect(BasePage.fileMenu).toBeExisting();
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await (await BasePage.fileMenuButton).waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();
    await expect(BasePage.fileMenuLogout).toBeDisplayed();
    await expect(BasePage.googleAuthButton).not.toBeDisplayed();
    await expect(BasePage.githubAuthButton).not.toBeDisplayed();
    await expect(mockLogoutResponse).toBeRequestedTimes(0);
    await (await BasePage.fileMenuLogout).waitAndLeftClick();
    await expect(mockLogoutResponse).toBeRequestedTimes(1);
    await expect(BasePage.tags).toBeElementsArrayOfSize(2);
    await expect(BasePage.githubAuthButton).toBeExisting();
    await expect(BasePage.githubAuthButton).toBeDisplayed();
    await expect(BasePage.googleAuthButton).toBeExisting();
    await expect(BasePage.googleAuthButton).toBeDisplayed();
  });
});
