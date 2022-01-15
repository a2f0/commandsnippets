import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
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
    expect(await BasePage.entrySearch).toBeExisting();
    expect(await BasePage.entrySearch).toBeDisplayed();
    assert.strictEqual(await BasePage.entrySearch.isFocused(), false);

    assert.strictEqual(await BasePage.tagSearch.isFocused(), true);
    await browser.keys('Tab');
    await browser.waitUntil(
      async () => {
        return (await BasePage.entrySearch.isFocused()) === true;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entry search to be focused after pressing tab.',
      }
    );

    await browser.keys('Tab');
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

    await browser.keys('Tab');
    await browser.waitUntil(
      async () => {
        return (await BasePage.entrySearch.isFocused()) === true;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entry search to be focused after pressing tab.',
      }
    );

    expect(await BasePage.tagsEntries.length).toEqual(2);
    await browser.keys(textEntriesResponse.data[0].attributes.subject);
    await browser.waitUntil(
      async () => {
        return (await BasePage.tagsEntries.length) === 1;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entries to be filtered after search.',
      }
    );

    await browser.keys('Escape');
    await browser.waitUntil(
      async () => {
        return (await BasePage.tagsEntries.length) === 2;
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected entries to be unfiltered after pressing escape.',
      }
    );
    assert.strictEqual(await BasePage.tagSearch.isFocused(), true);
  });
});
