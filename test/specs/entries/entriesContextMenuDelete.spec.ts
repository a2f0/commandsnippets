import {entriesResponse} from '../../mocks/entries/entriesResponse';
import {tagsResponse} from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Delete Entry', () => {
  it.skip('Should allow delete entries from untagged entries', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse, {statusCode: 200});

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tagsResponse, {statusCode: 200});
    await browser.login();
    await BasePage.open('test/test-tag-1');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    await expect(mockEntries).toBeRequestedTimes(2);
    await expect(mockTags).toBeRequestedTimes(1);

    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await (await BasePage.entriesMenuUntagged).waitAndLeftClick();
    await expect(browser).toHaveUrl(
      'http://localhost:8081/test?entries=untagged'
    );
    await expect(mockEntries).toBeRequestedTimes(3);
    await expect(mockTags).toBeRequestedTimes(1);
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);

    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Delete).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Untag).not.toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
