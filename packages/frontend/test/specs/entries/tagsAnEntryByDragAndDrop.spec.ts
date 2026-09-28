import {BasePage} from '../../pageobjects/base';

const TAGS_ENTRIES = 'http://localhost:9001/api/v1/tags_entries';

describe('Entry Drag and Drop', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('tags an entry dropped on a tag', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await browser.login();
    await BasePage.open('test/test-tag-1');
    await expect(BasePage.tagsEntries1).toBeDisplayed();

    // Drag entry 1, by its handle, onto test-tag-2
    await BasePage.dragAndDrop(
      '#tagsEntries-1 [role="entryDragHandle"]',
      '#tag-2'
    );
    await browser.waitUntil(
      async () =>
        (await browser.getMSWRequestCount('POST', TAGS_ENTRIES)) === 1,
      {timeoutMsg: 'Expected one POST to /tags_entries'}
    );

    // Entry 1 stays in test-tag-1, and test-tag-2 lists it now
    await expect(BasePage.tagsEntries1).toBeDisplayed();
    await BasePage.tag('2').waitAndLeftClick();
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-2');
    await expect(BasePage.tagsEntries1).toBeDisplayed();
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(1);

    // The API counts the new junction on both ends
    expect(await BasePage.fetchApi('/tags')).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: '2',
          attributes: expect.objectContaining({entry_count: 1}),
        }),
      ]),
    });
    expect(await BasePage.fetchApi('/entries')).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: '1',
          attributes: expect.objectContaining({tag_count: 2}),
        }),
      ]),
    });

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
