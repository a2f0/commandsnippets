import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagTextEntryThroughModelsResponse from '../../mocks/tag_text_entry_through_models/tagTextEntryThroughModelsResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Entry Main Menu Behavior', () => {
  it('should having a working menu bar', async () => {
    const mostEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mostEntriesResponse.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
  });

  it('should having a working new entry from the file menu', async () => {
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
    mockEntriesGetList.respond(entriesResponse, {fetchResponse: false});
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse, {fetchResponse: false});
    mocktagTextEntryThroughModelsResponse.respond(
      tagTextEntryThroughModelsResponse,
      {fetchResponse: false}
    );
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
    await expect(await BasePage.tagsEntries.length).toBe(4);
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
  });
});
