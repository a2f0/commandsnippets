import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';

describe('Entries Context Menu Delete Entry', () => {
  it('Should allow delete entries from untagged entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'get',
      }
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'get',
    });
    mockTags.respond(tags, {fetchResponse: false});
    mockEntries.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1', {
      wait: 5000,
    });
    await expect(await BasePage.tagsEntries.length).toEqual(4);
    await expect(mockEntries).toBeRequestedTimes(1);
    await expect(mockTags).toBeRequestedTimes(1);

    await expect(BasePage.entriesMenu).toBeExisting();
    await expect(BasePage.entriesMenu).not.toBeDisplayed();
    await (await BasePage.entriesMenuButton).waitAndLeftClick();
    await expect(BasePage.entriesMenu).toBeDisplayed();
    await (await BasePage.entriesMenuUntagged).waitAndLeftClick();
    await expect(browser).toHaveUrl(
      'http://localhost:8081/test?entries=untagged'
    );
    await expect(mockEntries).toBeRequestedTimes(2);
    await expect(mockTags).toBeRequestedTimes(1);
    assert.strictEqual(await BasePage.tagsEntries.length, 4);

    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Delete).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Untag).not.toBeDisplayed();
  });
});
