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
    mockTags.respond(tagsResponse);
    mockEntriesGetList.respond(entriesResponse);
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse);
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
    await expect(BasePage.tagsEntriesList).not.toBeDisplayed();
    await browser.switchWindow('http://localhost:8081');
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
