import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tag Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntries.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();
    await expect(BasePage.tags).toBeElementsArrayOfSize(2);
    // mockTags.respond(tagsResponseEmpty, {fetchResponse: false});
    // mockTagsEntries.respond(tagsEntriesResponseEmpty, {fetchResponse: false});
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();
    await (await BasePage.tag1).waitAndRightClick();
    await expect(BasePage.tagContextMenu1).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();
  });
});
