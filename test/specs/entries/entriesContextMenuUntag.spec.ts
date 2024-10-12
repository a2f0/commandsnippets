import entriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Entries Context Menu Untag', () => {
  it('should untag', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tags);

    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries/1',
      {method: 'DELETE'}
    );
    mockTagsEntries.respond(tags, {statusCode: 204});

    await BasePage.open('');
    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    await expect(mockEntries).toBeRequestedTimes(2);
    await expect(mockTags).toBeRequestedTimes(2);
    await expect(mockTagsEntries).toBeRequestedTimes(0);
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Untag).toBeDisplayed();
    await (await BasePage.tagsEntriesContextMenu1Untag).waitAndLeftClick();
    await expect(mockTagsEntries).toBeRequestedTimes(2);
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(3);
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
