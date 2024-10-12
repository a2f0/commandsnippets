import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';
import {BasePage} from '../../pageobjects/base';

describe('Tag Main Menu', () => {
  it('should having a working menu bar', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse);

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*'
    );
    mockTags.respond(tagsResponse);

    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();

    await expect(BasePage.tagsMenu).toBeExisting();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();

    // // Make sure the first tag is selected
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    // https://webdriver.io/docs/autowait/#limitations

    let tags = await BasePage.tags;
    await browser.pause(2000);
    await expect(
      (await $('div[data-testid="tag-1"]').getCSSProperty('background-color'))
        .value
    ).toBe('rgba(72,72,72,1)');

    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // initial state of order by order
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0].getAttribute('id');
        return firstId === 'tag-1';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-1 to be first',
      }
    );

    // click the tags menu button and make sure the menu becomes visible
    await expect(BasePage.tagsMenuButton).toBeExisting();
    await expect(BasePage.tagsMenuButton).toBeDisplayed();
    await expect(BasePage.tagsMenuButton).toBeClickable();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();
    await BasePage.tagsMenuButton.click({button: 'left'});
    await expect(BasePage.tagsMenu).toBeDisplayed();

    // click the sort by date create ascending and make sure the menu disappears
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeExisting();
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeDisplayed();
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeClickable();
    await BasePage.tagsMenuSortDateCreatedAscending.click({button: 'left'});
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // make sure the oldest date is on top
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0].getAttribute('id');
        const secondId = await tags[1].getAttribute('id');
        return firstId === 'tag-1' && secondId === 'tag-2';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-1 to be first and tag-2 to be second',
      }
    );

    // click the tags menu button and make sure the menu becomes visible
    await expect(BasePage.tagsMenuButton).toBeClickable();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();
    await BasePage.tagsMenuButton.click({button: 'left'});
    await expect(BasePage.tagsMenu).toBeDisplayed();

    // click the sort by date create descending and make sure the menu disappears
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeExisting();
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeDisplayed();
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeClickable();
    BasePage.tagsMenuSortDateCreatedDescending.click({button: 'left'});
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // make sure the oldest date is on bottom now
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0].getAttribute('id');
        const secondId = await tags[1].getAttribute('id');
        return firstId === 'tag-4' && secondId === 'tag-3';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-4 to be first and tag-3 to be second',
      }
    );

    await expect(
      (await $('div[data-testid="tag-1"]').getCSSProperty('background-color'))
        .value
    ).toBe('rgba(72,72,72,1)');
    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
