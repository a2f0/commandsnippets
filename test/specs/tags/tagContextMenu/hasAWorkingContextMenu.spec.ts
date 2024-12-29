import entriesResponse from '../../../mocks/entries/entriesResponse';
import tagsResponse from '../../../mocks/tags/tagsResponse';
import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  it.skip('has a working context menu', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {
        method: 'GET',
      }
    );
    mockTags.respond(tagsResponse, {statusCode: 200});
    mockEntries.respond(entriesResponse, {statusCode: 200});
    await browser.login();
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();
    await (await BasePage.tag1).waitAndRightClick();
    await expect(BasePage.tagContextMenu1).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();
  });
});
