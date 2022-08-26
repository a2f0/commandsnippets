import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';

describe('Entries Context Manu Untagging', () => {
  it('should untag', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'get',
      }
    );
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries/**',
      {
        method: 'delete',
      }
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    mockTagsEntries.respond(tags, {fetchResponse: false, statusCode: 204});
    mockTags.respond(tags, {fetchResponse: false});
    mockEntries.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    assert.strictEqual(await BasePage.tagsEntries.length, 4);
    await expect(mockEntries).toBeRequestedTimes(1);
    await expect(mockTags).toBeRequestedTimes(1);
    await expect(mockTagsEntries).toBeRequestedTimes(0);
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Untag).toBeDisplayed();
    await (await BasePage.tagsEntriesContextMenu1Untag).waitAndLeftClick();
    await expect(mockTagsEntries).toBeRequestedTimes(1);
  });
});
