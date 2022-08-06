import {BasePage} from '../../pageobjects/base';
import entriesResponseEmpty from '../../mocks/entries/entriesResponseEmpty';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagTextEntryThroughModelsResponse from '../../mocks/tag_text_entry_through_models/tagTextEntryThroughModelsResponse';
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
    const mocktagTextEntryThroughModelsResponse = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {
        method: 'post',
      }
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntriesGetList.respond(entriesResponseEmpty, {fetchResponse: false});
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse, {fetchResponse: false});
    mocktagTextEntryThroughModelsResponse.respond(
      tagTextEntryThroughModelsResponse,
      {fetchResponse: false}
    );
    await BasePage.open('');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Window change behavior
    await browser.newWindow('https://google.com');
    await browser.switchWindow('google.com');
    await expect(BasePage.tagsEntriesList).not.toBeDisplayed();
    await browser.switchWindow('http://localhost:8081');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
  });
});
