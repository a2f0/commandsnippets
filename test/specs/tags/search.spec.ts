import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Tag Search Menu Behavior', () => {
  it('should have a functional search bar', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1**'
    );
    mockTags.respond(tagsResponse);

    await BasePage.open('');
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toBeExisting();
    await expect(BasePage.tagSearch).toBeDisplayed();
    await expect(BasePage.tagSearch).toBeFocused();
    await browser.keys(tagsResponse.data[1].attributes.name);
    await expect(BasePage.tags).toBeElementsArrayOfSize(1);
    expect(BasePage.tagSearch).toHaveValue(
      tagsResponse.data[1].attributes.name
    );

    await browser.keys('Escape');
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toHaveValue('');
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
