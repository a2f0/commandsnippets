import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tab Switching Behavior', () => {
  it('should allow tab switching while editing', async () => {
    const mockEntriesGetList = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'get',
      }
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    const mockEntryOptionsResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'options',
      }
    );
    const mockEntryPostResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'post',
      }
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntriesGetList.respond(entriesResponse, {fetchResponse: false});
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Edit).toBeDisplayed();
    await expect(BasePage.textEntryEdit1).not.toBeDisplayed();
    await (await BasePage.tagsEntriesContextMenu1Edit).waitAndLeftClick();
    await expect(BasePage.textEntryEdit1).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Subject).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Body).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Save).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Cancel).toBeDisplayed();

    expect(BasePage.textEntryEdit1Body).toHaveValue(
      entriesResponse.data[0].attributes.body
    );
    expect(BasePage.textEntryEdit1Subject).toHaveValue(
      entriesResponse.data[0].attributes.subject
    );

    // Window change behavior
    await browser.newWindow('https://google.com');
    await browser.switchWindow('google.com');
    await expect(BasePage.tagsEntriesList).not.toBeDisplayed();
    await browser.switchWindow('http://localhost:8081');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
  });
});
