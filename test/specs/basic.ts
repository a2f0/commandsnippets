import {BasePage} from '../pageobjects/base';
import assert from 'assert';
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
    await expect(BasePage.tagParent).toBeDisplayed();
    await expect(BasePage.tagContext).toBeExisting();
    const tagParent = await BasePage.tagParent;
    const tagDivs = await BasePage.tagDivs;
    const tagContext = await BasePage.tagContext;
    await expect(tagDivs.length).toEqual(2);

    let tagContextVisibility = await tagContext.getCSSProperty('visibility');
    assert.strictEqual(tagContextVisibility.value, 'hidden');

    tagParent.click({button: 'right'});
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
