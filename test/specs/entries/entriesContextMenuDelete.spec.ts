import {BasePage} from '../../pageobjects/base';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tags from '../../mocks/tags/tagsResponse';

describe('Entries Context Menu Delete Entry', () => {
  it('Should allow delete entries from untagged entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {
        method: 'GET',
      }
    );
    const mockTags = await browser.mock('http://localhost:9001/api/v1/tags**', {
      method: 'GET',
    });
    mockTags.respond(tags);
    mockEntries.respond(entriesResponse);
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1', {
      wait: 5000,
    });
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);
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
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(4);

    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();
    await expect(BasePage.tagsEntriesContextMenu1).not.toBeDisplayed();
    await (await BasePage.tagsEntries1).waitAndRightClick();
    await expect(BasePage.tagsEntriesContextMenu1).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Delete).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1Untag).not.toBeDisplayed();
    mockEntries.restore();
    mockTags.restore();
  });
});
