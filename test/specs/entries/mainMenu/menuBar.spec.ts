import entriesResponse from '../../../mocks/entries/entriesResponse';
import tagsResponse from '../../../mocks/tags/tagsResponse';
import {BasePage} from '../../../pageobjects/base';

describe('Entry Main Menu', () => {
  it('should having a working menu bar', async () => {
    const mockEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntriesResponse.respond(entriesResponse, {statusCode: 200});

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tagsResponse, {statusCode: 200});
    await browser.login();
    await BasePage.open('');
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
