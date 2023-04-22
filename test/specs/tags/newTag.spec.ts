import {BasePage} from '../../pageobjects/base';
import entriesResponseEmpty from '../../mocks/entries/entriesResponseEmpty';
import tagsPostResponse from '../../mocks/tags/tagsPostResponse';
import tagsResponseEmpty from '../../mocks/tags/tagsResponseEmpty';

describe('Tag List Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    const mockTagOptionsResponse = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {
        method: 'options',
      }
    );
    const mockTagPostResponse = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {
        method: 'post',
      }
    );
    mockTags.respond(tagsResponseEmpty, {fetchResponse: false});
    mockEntries.respond(entriesResponseEmpty, {fetchResponse: false});
    mockTagOptionsResponse.respond({fetchResponse: false});
    mockTagPostResponse.respond(tagsPostResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
    await (await BasePage.tagList).waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
    await (await BasePage.tagList).waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();

    await (await BasePage.tagListContextMenuNew).waitAndLeftClick();
    await expect(BasePage.tagNewBottom).toBeDisplayed();

    await expect(BasePage.tagNewBottomTextField).toBeDisplayed();
    await expect(BasePage.tagNewBottomTextField).toBeFocused();
    await expect(BasePage.tagNewBottomSave).toBeDisplayed();
    await browser.keys('Tab');
    await expect(BasePage.tagNewBottomSave).toBeFocused();
    await expect(BasePage.tagNewBottomCancel).toBeDisplayed();
    await browser.keys('Tab');
    await expect(BasePage.tagNewBottomCancel).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.tagNewBottomTextField).toBeFocused();
    browser.keys('test-3');
    expect(BasePage.tagNewBottomTextField).toHaveValue('test-3');
    await expect(BasePage.tags).toBeElementsArrayOfSize(0);
    expect(mockTagPostResponse).toBeRequestedTimes(0);
    await (await BasePage.tagNewBottomSave).waitAndLeftClick();
    expect(mockTagPostResponse).toBeRequestedTimes(1);
    await expect(BasePage.tags).toBeElementsArrayOfSize(1);
    await expect(BasePage.tagNewBottom).not.toBeDisplayed();
  });
});
