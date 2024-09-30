import {BasePage} from '../../pageobjects/base';
import entriesPatchResponse from '../../mocks/entries/entryPatchResponse';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';

describe('TagsEntries Behavior', () => {
  it('should list entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {
        method: 'GET',
      }
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1**',
      {
        method: 'GET',
      }
    );
    mockTags.respond(tags);
    mockEntries.respond(entriesResponse);
    await BasePage.open('test/test-tag-1');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    mockEntries.restore();
    mockTags.restore();
  });

  it('should have a working editor', async () => {
    const mockEntriesPatch = await browser.mock(
      'http://localhost:9001/api/v1/entries/1',
      {
        method: 'PATCH',
      }
    );
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {
        method: 'GET',
      }
    );

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1**',
      {
        method: 'GET',
      }
    );
    mockTags.respond(tags);
    mockEntries.respond(entriesResponse);
    mockEntriesPatch.respond(entriesPatchResponse);

    await BasePage.open('test/test-tag-1');

    await expect(BasePage.tagsEntriesList).toBeExisting();
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
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Save).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Cancel).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    await (await BasePage.textEntryEdit1Cancel).waitAndLeftClick();
    await expect(BasePage.textEntryEdit1).not.toBeDisplayed();

    //
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Edit).toBeDisplayed();
    await expect(BasePage.textEntryEdit1).not.toBeDisplayed();
    await (await BasePage.tagsEntriesContextMenu1Edit).waitAndLeftClick();
    await expect(BasePage.textEntryEdit1).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();
    await browser.keys('-modified');
    expect(BasePage.textEntryEdit1Subject).toHaveValue(
      entriesResponse.data[0].attributes.subject + '-modified'
    );

    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    // ArrowDown will go to the end of the line because there isn't a second line.
    await browser.keys('ArrowDown');
    // Create a blank line
    await browser.keys('Enter');
    await browser.keys('entry-1-body-line-2');
    expect(BasePage.textEntryEdit1Body).toHaveValue(
      entriesResponse.data[0].attributes.body + '\n' + 'entry-1-body-line-2'
    );
    await browser.keys('Tab');
    await expect(BasePage.textEntryEdit1Save).toBeFocused();
    await expect(mockEntriesPatch).toBeRequestedTimes(0);
    await browser.keys('Enter');
    await expect(BasePage.textEntryEdit1).not.toBeDisplayed();
    await expect(mockEntriesPatch).toBeRequestedTimes(1);
    mockEntriesPatch.restore();
    mockEntries.restore();
    mockTags.restore();
  });
});
