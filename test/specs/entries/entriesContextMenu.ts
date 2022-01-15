import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tags from '../../mocks/tags/tagsResponse';
import textEntriesResponse from '../../mocks/entries/entriesResponse';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tags, {fetchResponse: false});
    mockEntries.respond(textEntriesResponse, {fetchResponse: false});
    await BasePage.open('test/test');
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tagsEntriesContextMenu1).toBeExisting();

    assert.strictEqual(
      (
        await (
          await BasePage.tagsEntriesContextMenu1
        ).getCSSProperty('visibility')
      ).value,
      'hidden'
    );

    await BasePage.tagsEntries1.click({button: 'right'});

    await browser.waitUntil(
      async () => {
        return (
          (
            await (
              await BasePage.tagsEntriesContextMenu1
            ).getCSSProperty('visibility')
          ).value === 'visible'
        );
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tagsEntries context to be visible after 3s.',
      }
    );

    await browser.keys('Escape');

    await browser.waitUntil(
      async () => {
        return (
          (
            await (
              await BasePage.tagsEntriesContextMenu1
            ).getCSSProperty('visibility')
          ).value === 'hidden'
        );
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tagsEntries context to be visible after 3s.',
      }
    );
  });
});
