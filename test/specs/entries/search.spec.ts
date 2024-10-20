import textEntriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*'
    );
    mockEntries.respond(textEntriesResponse, {statusCode: 200});

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*'
    );
    mockTags.respond(tags, {statusCode: 200});
    await browser.login();
    await expect(BasePage.tagLine).toBeDisplayed();
    await BasePage.open('test/test-tag-1');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.entrySearch).toBeExisting();
    await expect(BasePage.entrySearch).toBeDisplayed();
    await expect(BasePage.entrySearch).not.toBeFocused();
    await expect(BasePage.tagSearch).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.entrySearch).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.tagSearch).toBeFocused();

    await browser.keys('Tab');
    await expect(BasePage.entrySearch).toBeFocused();

    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    expect(BasePage.entrySearch).toBeFocused();
    await browser.keys('e');
    await browser.keys('n');
    await browser.keys('t');
    await browser.keys('r');
    await browser.keys('y');
    await browser.keys('-');
    await browser.keys('1');
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(1);

    await browser.keys('Escape');
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toBeFocused();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
