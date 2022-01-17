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
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagList).toBeClickable();
    await BasePage.tagList.click({button: 'right'});
    await expect(BasePage.tagListContextMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
  });
});
