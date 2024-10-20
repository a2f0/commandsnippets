import entriesResponse from '../../../mocks/entries/entriesResponse';
import entryPostResponse from '../../../mocks/entries/entryPostResponse';
import tagTextEntryThroughModelsResponse from '../../../mocks/tag_text_entry_through_models/tagTextEntryThroughModelsResponse';
import tagsResponse from '../../../mocks/tags/tagsResponse';
import {BasePage} from '../../../pageobjects/base';

describe('Entry Main Menu', () => {
  it('should having a working new entry from the file menu', async () => {
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

    const mocktagTextEntryThroughModelsResponse = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries',
      {method: 'POST'}
    );
    mocktagTextEntryThroughModelsResponse.respond(
      tagTextEntryThroughModelsResponse,
      {statusCode: 201}
    );
    await expect(BasePage.tagLine).toBeDisplayed();
    await browser.login();
    await BasePage.open('');

    await expect(BasePage.fileMenu).toBeExisting();
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await (await BasePage.fileMenuButton).waitAndLeftClick();

    await expect(BasePage.fileMenu).toBeDisplayed();

    await browser.keys('Escape');
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await (await BasePage.fileMenuButton).waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();
    await expect(BasePage.entryNewTop).not.toBeExisting();
    await (await BasePage.fileMenuNewEntry).waitAndLeftClick();
    await expect(BasePage.entryNewTop).toBeExisting();
    await expect(BasePage.entryNewTop).toBeDisplayed();
    await expect(BasePage.entryNewTopSubject).toBeFocused();
    await (await BasePage.entryNewTopBody).waitAndLeftClick();
    await expect(BasePage.entryNewTopBody).toBeFocused();
    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');

    expect(BasePage.entryNewTopBody).toHaveValue('Body Line 1\nBody Line 2');
    await (await BasePage.entryNewTopSubject).waitAndLeftClick();
    await expect(BasePage.entryNewTopSubject).toBeFocused();
    await browser.keys('Subject');
    expect(BasePage.entryNewTopSubject).toHaveValue('Subject');

    await expect(BasePage.entryNewTop).toBeExisting();
    await (await BasePage.entryNewTopCancel).waitAndLeftClick();
    await expect(BasePage.entryNewTop).not.toBeExisting();

    // test save
    await expect(mockEntriesGetList).toBeRequestedTimes(2);
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
    await (await BasePage.fileMenuButton).waitAndLeftClick();

    await expect(BasePage.fileMenu).toBeDisplayed();
    await (await BasePage.fileMenuNewEntry).waitAndLeftClick();
    await expect(BasePage.entryNewTop).toBeExisting();
    await expect(BasePage.entryNewTop).toBeDisplayed();
    await browser.keys('Subject');
    expect(BasePage.entryNewTopSubject).toHaveValue('Subject');
    await (await BasePage.entryNewTopBody).waitAndLeftClick();
    await expect(BasePage.entryNewTopBody).toBeFocused();

    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');
    expect(BasePage.entryNewTopBody).toHaveValue('Body Line 1\nBody Line 2');
    await (await BasePage.entryNewTopSave).waitAndLeftClick();

    await expect(BasePage.entryNewTop).not.toBeExisting();
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(5);
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
