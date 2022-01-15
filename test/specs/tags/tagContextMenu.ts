import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponse from '../../mocks/tags_entries/tagsEntriesResponse';
import tagsEntriesResponseEmpty from '../../mocks/tags_entries/tagsEntriesResponseEmpty';
import tagsResponse from '../../mocks/tags/tagsResponse';
import tagsResponseEmpty from '../../mocks/tags_entries/tagsEntriesResponseEmpty';

describe('Tag Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
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
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    const tag1 = await BasePage.tag1;
    expect(tag1).toBeExisting();
    expect(tag1).toBeDisplayed();
    const tag2 = await BasePage.tag2;
    expect(tag2).toBeExisting();
    expect(tag2).toBeDisplayed();
    const tags = await BasePage.tags;
    const tagContextMenu1 = await BasePage.tagContextMenu1;
    expect(tags.length).toEqual(2);

    // don't bust the cache
    mockTags.respond(tagsResponseEmpty, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponseEmpty, {fetchResponse: false});

    let tagContextVisibility = await tagContextMenu1.getCSSProperty(
      'visibility'
    );
    assert.strictEqual(tagContextVisibility.value, 'hidden');

    tag1.click({button: 'right'});
    await tagContextMenu1.waitUntil(
      async () => {
        tagContextVisibility = await tagContextMenu1.getCSSProperty(
          'visibility'
        );
        return tagContextVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );

    await browser.keys('Escape');
    await tagContextMenu1.waitUntil(
      async () => {
        tagContextVisibility = await tagContextMenu1.getCSSProperty(
          'visibility'
        );
        return tagContextVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );
  });
});
