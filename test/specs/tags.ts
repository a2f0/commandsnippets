import {BasePage} from '../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponse from '../mocks/tags_entries/tagsEntriesResponse';
import tagsResponse from '../mocks/tags/tagsResponse';

describe('TagE Behavior', () => {
  it('should list tags', async () => {
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
    await expect(BasePage.tagContext).toBeExisting();
    const tag1 = await BasePage.tag1;
    const tags = await BasePage.tags;
    const tagContext = await BasePage.tagContext;
    expect(tags.length).toEqual(2);

    let tagContextVisibility = await tagContext.getCSSProperty('visibility');
    assert.strictEqual(tagContextVisibility.value, 'hidden');

    tag1.click({button: 'right'});
    await tagContext.waitUntil(
      async () => {
        tagContextVisibility = await tagContext.getCSSProperty('visibility');
        return tagContextVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );

    browser.keys('Escape');
    await tagContext.waitUntil(
      async () => {
        tagContextVisibility = await tagContext.getCSSProperty('visibility');
        return tagContextVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );
  });
});
