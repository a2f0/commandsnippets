import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tags from '../../mocks/tags/tagsResponse';
import textEntriesResponse from '../../mocks/entries/textEntriesResponse';

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
    expect(await BasePage.entrySearch).toBeExisting();
    expect(await BasePage.entrySearch).toBeDisplayed();
    assert.strictEqual(await BasePage.entrySearch.isFocused(), false);

    assert.strictEqual(await BasePage.tagSearch.isFocused(), true);
    browser.keys('Tab');
    await browser.waitUntil(
      async () => {
        return (await BasePage.entrySearch.isFocused()) === true;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entry search to be focussed after pressing tab.',
      }
    );

    browser.keys('Tab');
    await browser.waitUntil(
      async () => {
        return (await BasePage.entrySearch.isFocused()) === false;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entry search to be unfocused after pressing tab.',
      }
    );

    assert.strictEqual(await BasePage.tagSearch.isFocused(), true);
  });
});
