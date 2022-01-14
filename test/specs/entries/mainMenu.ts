import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import entriesResponse from '../../mocks/entries/entriesResponse';
import entryPostResponse from '../../mocks/entries/entryPostResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Entry Main Menu Behavior', () => {
  it('should having a working menu bar', async () => {
    const mostEntriesResponse = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mostEntriesResponse.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');

    expect(await BasePage.entriesMenu).toBeExisting();
    expect(await BasePage.entriesMenu).toBeDisplayed();

    assert.strictEqual(
      (await (await BasePage.entriesMenu).getCSSProperty('visibility')).value,
      'hidden'
    );

    await BasePage.entriesMenuButton.click({button: 'left'});
    assert.strictEqual(
      (await (await BasePage.entriesMenu).getCSSProperty('visibility')).value,
      'visible'
    );

    browser.keys('Escape');

    assert.strictEqual(
      (await (await BasePage.entriesMenu).getCSSProperty('visibility')).value,
      'hidden'
    );

    await BasePage.entriesMenuButton.click({button: 'left'});
    assert.strictEqual(
      (await (await BasePage.entriesMenu).getCSSProperty('visibility')).value,
      'visible'
    );
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
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntriesGetList.respond(entriesResponse, {fetchResponse: false});
    mockEntryOptionsResponse.respond({fetchResponse: false});
    mockEntryPostResponse.respond(entryPostResponse, {fetchResponse: false});
    await BasePage.open('');

    assert.strictEqual(
      (await (await BasePage.fileMenu).getCSSProperty('visibility')).value,
      'hidden'
    );

    await BasePage.fileMenuButton.click({button: 'left'});
    assert.strictEqual(
      (await (await BasePage.fileMenu).getCSSProperty('visibility')).value,
      'visible'
    );

    await browser.keys('Escape');

    assert.strictEqual(
      (await (await BasePage.fileMenu).getCSSProperty('visibility')).value,
      'hidden'
    );

    await BasePage.fileMenuButton.click({button: 'left'});
    assert.strictEqual(
      (await (await BasePage.fileMenu).getCSSProperty('visibility')).value,
      'visible'
    );

    await expect(BasePage.entryNewTop).not.toBeExisting();
    await BasePage.fileMenuNewEntry.click({button: 'left'});
    await expect(BasePage.entryNewTop).toBeExisting();
    assert.strictEqual(
      (await (await BasePage.entryNewTop).getCSSProperty('visibility')).value,
      'visible'
    );
    assert.strictEqual(
      (await (await BasePage.entryNewTopSubject).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(
      (await (await BasePage.entryNewTopBody).getCSSProperty('visibility'))
        .value,
      'visible'
    );
    assert.strictEqual(await BasePage.entryNewTopSubject.isFocused(), true);

    await BasePage.entryNewTopBody.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewTopBody.isFocused(), true);

    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');

    assert.strictEqual(
      await BasePage.entryNewTopBody.getValue(),
      'Body Line 1\nBody Line 2'
    );

    await BasePage.entryNewTopSubject.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewTopSubject.isFocused(), true);
    await browser.keys('Subject');
    assert.strictEqual(await BasePage.entryNewTopSubject.getValue(), 'Subject');

    await expect(BasePage.entryNewTop).toBeExisting();
    await BasePage.entryNewTopCancel.click({button: 'left'});
    await expect(BasePage.entryNewTop).not.toBeExisting();

    // test save
    await BasePage.fileMenuButton.click({button: 'left'});
    assert.strictEqual(
      (await (await BasePage.fileMenu).getCSSProperty('visibility')).value,
      'visible'
    );
    await BasePage.fileMenuNewEntry.click({button: 'left'});
    await expect(BasePage.entryNewTop).toBeExisting();
    await browser.keys('Subject');
    assert.strictEqual(await BasePage.entryNewTopSubject.getValue(), 'Subject');
    await BasePage.entryNewTopBody.click({button: 'left'});
    assert.strictEqual(await BasePage.entryNewTopBody.isFocused(), true);
    await browser.keys('Body Line 1');
    await browser.keys('Enter');
    await browser.keys('Body Line 2');
    assert.strictEqual(
      await BasePage.entryNewTopBody.getValue(),
      'Body Line 1\nBody Line 2'
    );
    // await BasePage.entryNewTopSave.click({button: 'left'});
    // await expect(BasePage.entryNewTop).not.toBeExisting();
  });
});
