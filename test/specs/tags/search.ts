import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponse from '../../mocks/tags_entries/tagsEntriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tag Search Menu Behavior', () => {
  it('should have a functional search bar', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponse, {fetchResponse: false});
    await BasePage.open('');
    const tags = await BasePage.tags;
    expect(tags.length).toEqual(2);
    const tagSearch = await BasePage.tagSearch;
    expect(tagSearch).toBeExisting();
    expect(tagSearch).toBeDisplayed();
    const isFocused = await tagSearch.isFocused();
    assert.strictEqual(isFocused, true);

    browser.keys(tagsResponse.data[1].attributes.name);
    await browser.waitUntil(
      async () => {
        const tags = await BasePage.tags;
        return tags.length === 1;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag tag list to be filtered by search.',
      }
    );
    assert.strictEqual(
      await tagSearch.getValue(),
      tagsResponse.data[1].attributes.name
    );

    // The escape key
    browser.keys('\uE00C');
    await browser.waitUntil(
      async () => {
        const tags = await BasePage.tags;
        return tags.length === 2;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag tag list to be filtered by search.',
      }
    );
    assert.strictEqual(await tagSearch.getValue(), '');
  });
});
