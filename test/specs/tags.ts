import {BasePage} from '../pageobjects/base';
import assert from 'assert';
import tagsEntriesResponse from '../mocks/tags_entries/tagsEntriesResponse';
import tagsEntriesResponseEmpty from '../mocks/tags_entries/tagsEntriesResponseEmpty';
import tagsResponse from '../mocks/tags/tagsResponse';
import tagsResponseEmpty from '../mocks/tags_entries/tagsEntriesResponseEmpty';

describe('Tag Behavior', () => {
  it('should list tags', async () => {
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
    const tags = await BasePage.tags;
    const tagContextMenu1 = await BasePage.tagContextMenu1;
    expect(tags.length).toEqual(2);

    // don't bust the cache
    mockTags.respond(tagsResponseEmpty, {fetchResponse: false});
    mockTagsEntries.respond(tagsEntriesResponseEmpty, {fetchResponse: false});

    let tagContextVisibility = await tagContextMenu1.getCSSProperty(
      'visibility'
    );
    assert.strictEqual(tagContextVisibility.value, 'hidden');

    tag1.click({button: 'right'});
    await tagContextMenu1.waitUntil(
      async () => {
        tagContextVisibility = await tagContextMenu1.getCSSProperty(
          'visibility'
        );
        return tagContextVisibility.value === 'visible';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );

    browser.keys('Escape');
    await tagContextMenu1.waitUntil(
      async () => {
        tagContextVisibility = await tagContextMenu1.getCSSProperty(
          'visibility'
        );
        return tagContextVisibility.value === 'hidden';
      },
      {
        timeout: 30000,
        timeoutMsg: 'expected tag context to be visible after 3s.',
      }
    );
  });

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
    tagsMenuButton.click({button: 'left'});
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
    tagsMenuSortDateCreatedAscending.click({button: 'left'});
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
        timeoutMsg: 'expected tag-2 to be first',
      }
    );

    tagsMenuButton.click({button: 'left'});
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

    // make sure the oldest date is on bottom
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0].getAttribute('id');
        const secondId = await tags[1].getAttribute('id');
        return firstId === 'tag-2' && secondId === 'tag-1';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-2 to be first',
      }
    );
  });
});
