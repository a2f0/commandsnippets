import {BasePage} from '../../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponse from '../../mocks/tags_entries/tagsEntriesResponse';
import tagsResponse from '../../mocks/tags/tagsResponse';

describe('Tag Main Menu Behavior', () => {
  it('should having a working menu bar', async () => {
    const mockTagsEntries = await browser.mock(
      'http://localhost:9001/api/v1/tags_entries**',
      {}
    );
    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags**',
      {}
    );
    mockTags.respond(tagsResponse, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponse, {fetchResponse: false});
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    const tag1 = await BasePage.tag1;
    expect(tag1).toBeExisting();
    expect(tag1).toBeDisplayed();
    const tag2 = await BasePage.tag2;
    expect(tag2).toBeExisting();
    expect(tag2).toBeDisplayed();
    let tags = await BasePage.tags;
    expect(tags.length).toEqual(2);
    const tagsMenu = await BasePage.tagsMenu;
    expect(tagsMenu).toBeExisting();
    expect(tagsMenu).toBeDisplayed();
    const tagsMenuVisibility = await tagsMenu.getCSSProperty('visibility');
    assert.strictEqual(tagsMenuVisibility.value, 'hidden');
    const tagList = await BasePage.tagList;
    expect(tagList).toBeExisting();
    expect(tagList).toBeDisplayed();

    // Make sure the first tag is selected
    expect(tags.length).toEqual(2);
    let wrapper = await tags[0].$('div[id^="tagLabelWrapper-"]');
    let wrapperID = await wrapper.getAttribute('id');
    assert.strictEqual(wrapperID, 'tagLabelWrapper-1');
    let backgroundColor = await wrapper.getCSSProperty('background-color');
    assert.strictEqual(backgroundColor.value, 'rgba(72,72,72,1)');

    // check the initial browser url
    await browser.waitUntil(
      async () => {
        const url = await browser.getUrl();
        return url === 'http://localhost:8081/test/test';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected browser url to be different',
      }
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
    const tagsMenuButton = await BasePage.tagsMenuButton;
    expect(tagsMenuButton).toBeExisting();
    expect(tagsMenuButton).toBeDisplayed();
    await tagsMenuButton.click({button: 'left'});
    await tagsMenu.waitUntil(
      async () => {
        const tagsMenuVisibility = await tagsMenu.getCSSProperty('visibility');
        return tagsMenuVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag menu to be visible after 3s.',
      }
    );

    // click the sort by date create ascending and make sure the menu disappears
    const tagsMenuSortDateCreatedAscending =
      await BasePage.tagsMenuSortDateCreatedAscending;
    expect(tagsMenuSortDateCreatedAscending).toBeExisting();
    expect(tagsMenuSortDateCreatedAscending).toBeDisplayed();
    await tagsMenuSortDateCreatedAscending.click({button: 'left'});
    await tagsMenu.waitUntil(
      async () => {
        const tagsMenuVisibility = await tagsMenu.getCSSProperty('visibility');
        return tagsMenuVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag menu to be hidden after 3s.',
      }
    );

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
    await tagsMenuButton.click({button: 'left'});
    await tagsMenu.waitUntil(
      async () => {
        const tagsMenuVisibility = await tagsMenu.getCSSProperty('visibility');
        return tagsMenuVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag menu to be visible after 3s.',
      }
    );

    // click the sort by date create descending and make sure the menu disappears
    const tagsMenuSortDateCreatedDescending =
      await BasePage.tagsMenuSortDateCreatedDescending;
    expect(tagsMenuSortDateCreatedDescending).toBeExisting();
    expect(tagsMenuSortDateCreatedDescending).toBeDisplayed();
    tagsMenuSortDateCreatedDescending.click({button: 'left'});
    await tagsMenu.waitUntil(
      async () => {
        const tagsMenuVisibility = await tagsMenu.getCSSProperty('visibility');
        return tagsMenuVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag menu to be hidden after 3s.',
      }
    );

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

    const url = await browser.getUrl();
    assert.strictEqual(url, 'http://localhost:8081/test/test');
  });
});
