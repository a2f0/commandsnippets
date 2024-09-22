import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tab Switching Behavior', () => {
  it('should allow tab switching while editing', async () => {
    const mockEntryPostResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries',
      {
        method: 'POST',
      }
    );
    const mockEntriesGetList = await browser.mock(
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

    mockTags.respond(tagsResponse);
    mockEntryPostResponse.respond(entryPostResponse);
    mockEntriesGetList.respond(entriesResponse);
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(mockEntriesGetList).toBeRequestedTimes(1);
    await expect(mockTags).toBeRequestedTimes(1);
    await expect(await BasePage.tagsEntries.length).toBe(4);
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

    expect(BasePage.textEntryEdit1Subject).toHaveValue(
      entriesResponse.data[0].attributes.subject
    );
    expect(BasePage.textEntryEdit1Body).toHaveValue(
      entriesResponse.data[0].attributes.body
    );

    await expect(BasePage.textEntryEdit1Subject).toBeFocused();

    // Window change behavior
    await browser.newWindow('https://www.google.com/');
    // Entry Subject
    await browser.switchWindow('www.google.com');
    await expect(browser).toHaveUrl('https://www.google.com/');
    await browser.switchWindow('http://localhost:8081');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();

    // Entry Body
    await (await BasePage.textEntryEdit1Body).waitAndLeftClick();
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    await browser.keys('Enter');
    await browser.keys('Body Line 2');
    // Removing this await causes invalid session id.
    await expect(BasePage.textEntryEdit1Body).toHaveValue(
      'entry-1-body\nBody Line 2'
    );
    await browser.switchWindow('google.com');
    await expect(browser).toHaveUrl('https://www.google.com/');
    await browser.switchWindow('http://localhost:8081');
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    await browser.keys('Enter');
    await browser.keys('Body Line 3');
    await expect(BasePage.textEntryEdit1Body).toHaveValue(
      'entry-1-body\nBody Line 2\nBody Line 3'
    );
  });
});
