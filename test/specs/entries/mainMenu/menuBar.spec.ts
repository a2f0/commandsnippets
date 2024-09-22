import {BasePage} from '../../../pageobjects/base';
import entriesResponse from '../../../mocks/entries/entriesResponse';
import tagsResponse from '../../../mocks/tags/tagsResponse';

describe('Entry Main Menu', () => {
  it('should having a working menu bar', async () => {
    const mockEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {method: 'GET'}
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'GET',
    });
    mockTags.respond(tagsResponse);
    mockEntriesResponse.respond(entriesResponse);
    await BasePage.open('');
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    mockEntriesResponse.restore();
    mockTags.restore();
  });
});
