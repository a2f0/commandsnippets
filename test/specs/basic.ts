import {BasePage} from '../pageobjects/base';
import tags from '../mocks/tags/tags';
import tagsEntries from '../mocks/tags_entries/tagsEntries';

describe('Page Behavior', () => {
  it('should load', async () => {
    await BasePage.open('');
  });
});
describe('Tag Behavior', () => {
  it('should list tags', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tags, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntries, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    const tagDivs = await BasePage.tagDivs;
    await expect(tagDivs.length).toEqual(2);
  });
});
