import entriesResponseEmpty from '../../mocks/entries/entriesResponseEmpty';
import tagsResponseEmpty from '../../mocks/tags/tagsResponseEmpty';
import {BasePage} from '../../pageobjects/base';

describe('Tag List Context Menu Behavior', () => {
  it('tag should have a working context menu', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1**',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponseEmpty);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1**'
    );
    mockTags.respond(tagsResponseEmpty);

    await BasePage.open('');
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
    await (await BasePage.tagList).waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();
    await browser.keys('Escape');
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();
    expect(mockEntries).toBeRequestedTimes(0);
    expect(mockTags).toBeRequestedTimes(1);
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
