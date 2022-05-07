import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tag Search Menu Behavior', () => {
  it('should have a functional search bar', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntries.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toBeExisting();
    await expect(BasePage.tagSearch).toBeDisplayed();
    await expect(BasePage.tagSearch).toBeFocused();
    await browser.keys(tagsResponse.data[1].attributes.name);
    await expect(BasePage.tags).toBeElementsArrayOfSize(1);
    await expect(BasePage.tagSearch).toHaveValue(
      tagsResponse.data[1].attributes.name
    );

    await browser.keys('Escape');
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toHaveValue('');
  });
});
