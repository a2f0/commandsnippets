import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import entriesResponseEmpty from '../../mocks/entries/entriesResponseEmpty';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagTextEntryThroughModelsResponse from '../../mocks/tag_text_entry_through_models/tagTextEntryThroughModelsResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Entry Main Menu Behavior', () => {
  it('should having a working context menu to create new entries', async () => {
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
    //
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse, {fetchResponse: false});
    mocktagTextEntryThroughModelsResponse.respond(
      tagTextEntryThroughModelsResponse,
      {fetchResponse: false}
    );
    await BasePage.open('');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.entryListContextMenu).not.toBeDisplayed();
    await BasePage.tagsEntriesList.click({button: 'right'});
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.entryListContextMenu).not.toBeDisplayed();
    await BasePage.tagsEntriesList.click({button: 'right'});

    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();

    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await BasePage.entryListContextMenuNewEntry.click({button: 'left'});

    await expect(BasePage.entryNewBottom).toBeDisplayed();

    await expect(BasePage.entryNewBottomSubject).toBeFocused();
    await expect(BasePage.entryNewBottomBody).toBeClickable();
    await BasePage.entryNewBottomBody.click({button: 'left'});

    await expect(BasePage.entryNewBottomBody).toBeFocused();

    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');

    await expect(BasePage.entryNewBottomBody).toHaveValue(
      'Body Line 1\nBody Line 2'
    );

    await BasePage.entryNewBottomSubject.click({button: 'left'});

    await expect(BasePage.entryNewBottomSubject).toBeFocused();
    await browser.keys('Subject');
    await expect(BasePage.entryNewBottomSubject).toHaveValue('Subject');

    await expect(BasePage.entryNewBottom).toBeExisting();
    await expect(BasePage.entryNewBottomCancel).toBeClickable();
    await BasePage.entryNewBottomCancel.click({button: 'left'});
    await expect(BasePage.entryNewBottom).not.toBeExisting();

    await expect(BasePage.tagsEntriesList).toBeClickable();
    await BasePage.tagsEntriesList.click({button: 'right'});
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();
    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await BasePage.entryListContextMenuNewEntry.click({button: 'left'});
    await expect(BasePage.entryNewBottom).toBeExisting();
    await expect(BasePage.entryNewBottom).toBeDisplayed();

    await expect(BasePage.entryNewBottomSubject).toBeFocused();

    await expect(BasePage.entryNewBottomSubject).toHaveValue('');

    await browser.keys('Subject');
    await expect(BasePage.entryNewBottomSubject).toHaveValue('Subject');
    await expect(BasePage.entryNewBottomBody).toBeDisplayed();
    await expect(BasePage.entryNewBottomBody).toBeClickable();
    await BasePage.entryNewBottomBody.click({button: 'left'});

    await expect(BasePage.entryNewBottomBody).toBeFocused();
    await expect(BasePage.entryNewBottomBody).toHaveValue('');
    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');

    await expect(BasePage.entryNewBottomBody).toHaveValue(
      'Body Line 1\nBody Line 2'
    );
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(0);

    await BasePage.entryNewBottomSave.click({button: 'left'});
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(1);

    const newEntry = $(`#entryBodyOuterDiv${entryPostResponse.data.id}`);

    await expect(newEntry).toExist();
    await expect(newEntry).toBeDisplayed();

    await browser.keys('Tab');
    assert.strictEqual(
      (await (await newEntry).getCSSProperty('background-color')).value,
      'rgba(15,15,15,1)'
    );
    await browser.keys('Tab');
    assert.strictEqual(
      (await (await newEntry).getCSSProperty('background-color')).value,
      'rgba(72,72,72,1)'
    );
    await browser.keys('Left arrow');
    assert.strictEqual(
      (await (await newEntry).getCSSProperty('background-color')).value,
      'rgba(15,15,15,1)'
    );
    await browser.keys('Right arrow');
    assert.strictEqual(
      (await (await newEntry).getCSSProperty('background-color')).value,
      'rgba(72,72,72,1)'
    );
    // test tab-based focusing
    await expect(BasePage.tagsEntriesList).toBeClickable();
    await BasePage.tagsEntriesList.click({button: 'right'});

    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();

    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeClickable();
    await BasePage.entryListContextMenuNewEntry.click({button: 'left'});

    await expect(BasePage.entryNewBottom).toBeDisplayed();
    assert.strictEqual(await BasePage.entryNewBottomSubject.isFocused(), true);
    await browser.keys('Tab');
    assert.strictEqual(await BasePage.entryNewBottomBody.isFocused(), true);
    await browser.keys('Tab');
    assert.strictEqual(await BasePage.entryNewBottomSave.isFocused(), true);
    await browser.keys('Tab');
    assert.strictEqual(await BasePage.entryNewBottomCancel.isFocused(), true);
    await browser.keys('Tab');
    assert.strictEqual(await BasePage.entryNewBottomSubject.isFocused(), true);
    await browser.keys('Tab');
    assert.strictEqual(await BasePage.entryNewBottomBody.isFocused(), true);

    // Make sure the subject is the default focus on the component load
    // Note: the state of focus was the body up until this point.
    await expect(BasePage.entryNewBottomCancel).toBeClickable();
    await BasePage.entryNewBottomCancel.click({button: 'left'});
    await expect(BasePage.entryNewBottom).not.toBeExisting();
    await BasePage.tagsEntriesList.click({button: 'right'});
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();
    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeClickable();
    await BasePage.entryListContextMenuNewEntry.click({button: 'left'});
    await expect(BasePage.entryNewBottom).toBeDisplayed();
    await expect(BasePage.entryNewBottomSubject).toBeFocused();
    await expect(BasePage.entryNewBottomBody).toBeDisplayed();
    await expect(BasePage.entryNewBottomBody).toBeClickable();
    await BasePage.entryNewBottomBody.click({button: 'left'});
    await expect(BasePage.entryNewBottomBody).toBeFocused();
    await browser.keys('Tab');
    await expect(BasePage.entryNewBottomSave).toBeFocused();
  });
});
