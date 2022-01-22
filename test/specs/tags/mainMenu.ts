import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import entriesResponse from '../../mocks/entries/entriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tag Main Menu Behavior', () => {
  it('should having a working menu bar', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries**',
      {method: 'get'}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockEntries.respond(entriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tags).toBeElementsArrayOfSize(2);
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();

    await expect(BasePage.tagsMenu).toBeExisting();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();

    // // Make sure the first tag is selected
    await expect(BasePage.tags).toBeElementsArrayOfSize(2);
    // https://webdriver.io/docs/autowait/#limitations

    let tags = await BasePage.tags;
    let wrapper = await tags[0].$('div[id^="tagLabelWrapper-"]');
    let wrapperID = await wrapper.getAttribute('id');
    assert.strictEqual(wrapperID, 'tagLabelWrapper-1');
    let backgroundColor = await wrapper.getCSSProperty('background-color');
    assert.strictEqual(backgroundColor.value, 'rgba(72,72,72,1)');

    // check the initial browser url
    assert.strictEqual(
      await browser.getUrl(),
      'http://localhost:8081/test/test'
    );

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
        return firstId === 'tag-2' && secondId === 'tag-1';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-2 to be first and tag-1 to be second',
      }
    );

    // Make sure the tag is on the bottom but still selected
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        wrapper = await tags[1].$('div[id^="tagLabelWrapper-"]');
        wrapperID = await wrapper.getAttribute('id');
        assert.strictEqual(wrapperID, 'tagLabelWrapper-1');
        backgroundColor = await wrapper.getCSSProperty('background-color');
        return backgroundColor.value === 'rgba(72,72,72,1)';
      },
      {
        timeout: 120000,
        timeoutMsg: 'expected tag 1 to still be selected',
      }
    );

    assert.strictEqual(
      await browser.getUrl(),
      'http://localhost:8081/test/test'
    );
  });
});
