import {BasePage} from '../pageobjects/base';
import tags from '../mocks/tags/tagsResponse';
import tagsEntriesResponse from '../mocks/tags_entries/tagsEntriesResponse';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tags, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    const tagsEntries = await BasePage.tagsEntries;
    expect(tagsEntries.length).toEqual(2);
  });
});
