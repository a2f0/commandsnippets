import {BasePage} from '../pageobjects/base';
import assert from 'assert';
import tags from '../mocks/tags/tagsResponse';
import tagsEntriesResponse from '../mocks/tags_entries/tagsEntriesResponse';
import textEntriesResponse from '../mocks/entries/textEntriesResponse';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tags, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponse, {fetchResponse: false});
    mockEntries.respond(textEntriesResponse, {fetchResponse: false});
    await BasePage.open('test/test');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    const tagsEntries1 = await BasePage.tagsEntries1;
    const tagsEntries = await BasePage.tagsEntries;
    const tagsEntriesContextMenu1 = await BasePage.tagsEntriesContextMenu1;
    expect(tagsEntries.length).toEqual(1);

    let tagsEntriesContextVisibility =
      await tagsEntriesContextMenu1.getCSSProperty('visibility');
    assert.strictEqual(tagsEntriesContextVisibility.value, 'hidden');

    tagsEntries1.click({button: 'right'});
    await tagsEntriesContextMenu1.waitUntil(
      async () => {
        tagsEntriesContextVisibility =
          await tagsEntriesContextMenu1.getCSSProperty('visibility');
        return tagsEntriesContextVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tagsEntries context to be visible after 3s.',
      }
    );

    browser.keys('Escape');
    await tagsEntriesContextMenu1.waitUntil(
      async () => {
        tagsEntriesContextVisibility =
          await tagsEntriesContextMenu1.getCSSProperty('visibility');
        return tagsEntriesContextVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tagsEntries context to be visible after 3s.',
      }
    );
  });
});
