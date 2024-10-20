import entriesResponse from '../../mocks/entries/entriesResponse';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Tab Switching Behavior', () => {
  it('should allow tab switching while editing', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    const mockEntryPostResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries',
      {method: 'POST'}
    );
    mockEntryPostResponse.respond(entryPostResponse, {statusCode: 201});

    const mockEntriesGetList = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntriesGetList.respond(entriesResponse, {statusCode: 200});

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {method: 'GET'}
    );
    mockTags.respond(tagsResponse, {statusCode: 200});

    await browser.login();

    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(mockEntriesGetList).toBeRequestedTimes(2);
    await expect(mockTags).toBeRequestedTimes(2);
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
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
    await BasePage.textEntryEdit1Body.waitAndLeftClick();
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
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
