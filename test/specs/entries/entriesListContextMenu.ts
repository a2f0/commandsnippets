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
    assert.strictEqual(
      (await (await BasePage.entryNewBottom).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(
      (
        await (
          await BasePage.entryNewBottomSubject
        ).getCSSProperty('visibility')
      ).value,
      'visible'
    );
    assert.strictEqual(
      (await (await BasePage.entryNewBottomBody).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(await BasePage.entryNewBottomSubject.isFocused(), true);
    assert.strictEqual(await BasePage.entryNewBottomBody.isFocused(), false);
    await expect(BasePage.entryNewBottomBody).toBeDisplayed();
    await BasePage.entryNewBottomBody.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewBottomBody.isFocused(), true);

    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');

    assert.strictEqual(
      await BasePage.entryNewBottomBody.getValue(),
      'Body Line 1\nBody Line 2'
    );

    await BasePage.entryNewBottomSubject.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewBottomSubject.isFocused(), true);

    await browser.keys('Subject');
    assert.strictEqual(
      await BasePage.entryNewBottomSubject.getValue(),
      'Subject'
    );

    await expect(BasePage.entryNewBottom).toBeExisting();
    await BasePage.entryNewBottomCancel.click({button: 'left'});
    await expect(BasePage.entryNewBottom).not.toBeExisting();

    await BasePage.tagsEntriesList.click({button: 'right'});
    await expect(BasePage.entryListContextMenu).toBeDisplayed();
    await expect(BasePage.entryListContextMenuNewEntry).toBeDisplayed();
    await expect(BasePage.entryNewBottom).not.toBeDisplayed();
    await BasePage.entryListContextMenuNewEntry.click({button: 'left'});
    await expect(BasePage.entryNewBottom).toBeExisting();
    await expect(BasePage.entryNewBottom).toBeDisplayed();

    assert.strictEqual(
      (await (await BasePage.entryNewBottom).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(
      (
        await (
          await BasePage.entryNewBottomSubject
        ).getCSSProperty('visibility')
      ).value,
      'visible'
    );
    assert.strictEqual(
      (await (await BasePage.entryNewBottomBody).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(await BasePage.entryNewBottomSubject.isFocused(), true);
    assert.strictEqual(await BasePage.entryNewBottomSubject.getValue(), '');
    await browser.keys('Subject');
    assert.strictEqual(
      await BasePage.entryNewBottomSubject.getValue(),
      'Subject'
    );
    await expect(BasePage.entryNewBottomBody).toBeDisplayed();
    await BasePage.entryNewBottomBody.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewBottomBody.isFocused(), true);
    assert.strictEqual(await BasePage.entryNewBottomBody.getValue(), '');
    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');
    assert.strictEqual(
      await BasePage.entryNewBottomBody.getValue(),
      'Body Line 1\nBody Line 2'
    );
    assert.strictEqual(await BasePage.tagsEntries.length, 0);
    await BasePage.entryNewBottomSave.click({button: 'left'});
    assert.strictEqual(await BasePage.tagsEntries.length, 1);

    assert.strictEqual(
      (
        await (
          await $(`#entryBodyOuterDiv${entryPostResponse.data.id}`)
        ).getCSSProperty('background-color')
      ).value,
      'rgba(72,72,72,1)'
    );
    browser.keys('Tab');
    assert.strictEqual(
      (
        await (
          await $(`#entryBodyOuterDiv${entryPostResponse.data.id}`)
        ).getCSSProperty('background-color')
      ).value,
      'rgba(15,15,15,1)'
    );
    browser.keys('Tab');
    assert.strictEqual(
      (
        await (
          await $(`#entryBodyOuterDiv${entryPostResponse.data.id}`)
        ).getCSSProperty('background-color')
      ).value,
      'rgba(72,72,72,1)'
    );
    browser.keys('Left arrow');
    assert.strictEqual(
      (
        await (
          await $(`#entryBodyOuterDiv${entryPostResponse.data.id}`)
        ).getCSSProperty('background-color')
      ).value,
      'rgba(15,15,15,1)'
    );
    browser.keys('Right arrow');
    assert.strictEqual(
      (
        await (
          await $(`#entryBodyOuterDiv${entryPostResponse.data.id}`)
        ).getCSSProperty('background-color')
      ).value,
      'rgba(72,72,72,1)'
    );
  });
});
