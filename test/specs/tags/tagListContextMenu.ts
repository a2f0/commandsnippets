import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponseEmpty from '../../mocks/tags_entries/tagsEntriesResponseEmpty';
import tagsResponseEmpty from '../../mocks/tags_entries/tagsEntriesResponseEmpty';

describe('Tag List Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponseEmpty, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponseEmpty, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagListContextMenu).toBeExisting();

    const tagListContextMenu = await BasePage.tagListContextMenu;
    let tagListContextMenuVisibility = await tagListContextMenu.getCSSProperty(
      'visibility'
    );
    assert.strictEqual(tagListContextMenuVisibility.value, 'hidden');

    const tagList = await BasePage.tagList;
    tagList.click({button: 'right'});
    await tagListContextMenu.waitUntil(
      async () => {
        tagListContextMenuVisibility = await tagListContextMenu.getCSSProperty(
          'visibility'
        );
        return tagListContextMenuVisibility.value === 'visible';
      },
      {
        timeout: 1000,
        timeoutMsg: 'expected tag list context menu to be visible after 1s.',
      }
    );

    browser.keys('Escape');
    await tagListContextMenu.waitUntil(
      async () => {
        tagListContextMenuVisibility = await tagListContextMenu.getCSSProperty(
          'visibility'
        );
        return tagListContextMenuVisibility.value === 'hidden';
      },
      {
        timeout: 1000,
        timeoutMsg: 'expected tag list context menu to be hidden after 1s',
      }
    );
  });
});
