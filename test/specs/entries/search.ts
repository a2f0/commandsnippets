import {BasePage} from '../../pageobjects/base';
import tags from '../../mocks/tags/tagsResponse';
import textEntriesResponse from '../../mocks/entries/entriesResponse';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tags, {fetchResponse: false});
    mockEntries.respond(textEntriesResponse, {fetchResponse: false});
    await BasePage.open('test/test');
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

    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(2);
    await browser.keys(textEntriesResponse.data[0].attributes.subject);
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(1);

    await browser.keys('Escape');
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(2);
    await expect(BasePage.tagSearch).toBeFocused();
  });
});
