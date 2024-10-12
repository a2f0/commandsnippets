import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Entry Main Menu Behavior', () => {
  it('should having a working context menu to create new entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1**',
      {method: 'GET'}
    );
    mockTags.respond(tagsResponse);

    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    await expect(mockEntries).toBeRequestedTimes(2);
    await expect(mockTags).toBeRequestedTimes(2);

    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await (await BasePage.entriesMenuUntagged).waitAndLeftClick();
    await expect(browser).toHaveUrl(
      'http://localhost:8081/test?entries=untagged'
    );
    await expect(mockEntries).toBeRequestedTimes(4);
    await expect(mockTags).toBeRequestedTimes(2);
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
