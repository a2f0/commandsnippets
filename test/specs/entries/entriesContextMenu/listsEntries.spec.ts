import entriesResponse from '../../../mocks/entries/entriesResponse';
import tags from '../../../mocks/tags/tagsResponse';
import {BasePage} from '../../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  it('should list entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tags);

    await BasePage.open('test/test-tag-1');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
