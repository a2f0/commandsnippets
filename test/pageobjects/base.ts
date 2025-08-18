import {entrySearchMethod} from '../../src/lib/shared';

export class Base {
  // home screen
  get tagLine(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagLine');
  }

  // file menu
  get githubAuthButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#githubAuthButton');
  }
  get googleAuthButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#googleAuthButton');
  }
  // file menu
  get fileMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu');
  }
  get fileMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-button');
  }
  get fileMenuNewEntry(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-new-entry');
  }
  get fileMenuLogout(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-logout');
  }

  // entries menu
  get entriesMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entries-menu');
  }
  get entriesMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entries-menu-button');
  }
  get entriesMenuUntagged(): ReturnType<WebdriverIO.Browser['$']> {
    return $(
      `#entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`
    );
  }

  // tags menu
  get tagsMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu');
  }
  get tagsMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu-button');
  }
  get tagsMenuSortDateCreatedAscending(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu-sort-date-created-ascending');
  }
  get tagsMenuSortDateCreatedDescending(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tags-menu-sort-date-created-descending');
  }

  // tags
  get tagList(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagList');
  }
  /**
   * Returns all tag elements. This is a WebdriverIO array-like object.
   */
  get tags(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('div[id^="tag-"]');
  }
  get tagListContextMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagListContextMenu');
  }
  get tagNewBottomTextField(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomTextField');
  }
  get tagNewBottom(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottom');
  }
  get tagNewBottomCancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomCancel');
  }
  get tagNewBottomSave(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomSave');
  }
  get tagListContextMenuNew(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagListContextMenuNew');
  }
  get tagContextMenu1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu-1');
  }
  get tagContextMenu1DeleteTagMenuItem(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu1DeleteTagMenuItem');
  }
  get tagContextMenu1DeleteTagDialog(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu1DeleteTagDialog');
  }
  get tagContextMenu1DeleteTagDialogDeleteButton(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tagContextMenu1DeleteTagDialogDeleteButton');
  }
  get tagContextMenu1DeleteTagDialogCancelButton(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tagContextMenu1DeleteTagDialogCancelButton');
  }
  get tag1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tag-1');
  }
  get tag2(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tag-2');
  }
  get tagSearch(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagSearch');
  }

  // entries
  get entryNewTop(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTop');
  }
  get entryNewTopSubject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopSubject');
  }
  get entryNewTopBody(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopBody');
  }
  get entryNewTopCancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopCancel');
  }
  get entryNewTopSave(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopSave');
  }
  get entryNewBottom(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottom');
  }
  get entryNewBottomSubject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomSubject');
  }
  get entryNewBottomBody(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomBody');
  }
  get entryNewBottomSave(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomSave');
  }
  get entryNewBottomCancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomCancel');
  }
  get entryListContextMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entryListContextMenu');
  }
  get entryListContextMenuNewEntry(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entryListContextMenuNewEntry');
  }
  get tagsEntriesList(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesList');
  }
  /**
   * Returns all tagsEntries elements. This is a WebdriverIO array-like object.
   */
  get tagsEntries(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('div[id^="tagsEntries-"]');
  }
  get entry1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntries-1');
  }
  get entryBodyOuterDiv3(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entryBodyOuterDiv3');
  }
  get tagsEntriesContextMenu1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu-1');
  }
  get tagsEntriesContextMenu1Edit(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu1Edit');
  }
  get tagsEntriesContextMenu1Untag(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu1Untag');
  }
  get tagsEntriesContextMenu1Delete(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu1Delete');
  }
  get textEntryEdit1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1');
  }
  get textEntryEdit1Subject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Subject');
  }
  get textEntryEdit1Body(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Body');
  }
  get textEntryEdit1Save(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Save');
  }
  get textEntryEdit1Cancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Cancel');
  }
  get tagsEntries1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntries-1');
  }
  get entrySearch(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntrySearch');
  }
  async open(path: string): Promise<ReturnType<WebdriverIO.Browser['url']>> {
    await browser.url(`http://localhost:8081/${path}`);

    // Wait for MSW to be ready after page load
    await browser.waitForMSW();
  }

  // Helper methods for API checks
  async checkTagsAndEntries() {
    return browser.execute(async () => {
      const [tagsResponse, entriesResponse] = await Promise.all([
        fetch('http://localhost:9001/api/v1/tags'),
        fetch('http://localhost:9001/api/v1/entries'),
      ]);
      const [tagsData, entriesData] = await Promise.all([
        tagsResponse.json(),
        entriesResponse.json(),
      ]);
      return {
        tagsOk: tagsResponse.ok,
        tagsCount: tagsData.data?.length || 0,
        entriesOk: entriesResponse.ok,
        entriesCount: entriesData.data?.length || 0,
      };
    });
  }

  async checkTagsAndEntriesWithFirstEntry() {
    return browser.execute(async () => {
      const [tagsResponse, entriesResponse] = await Promise.all([
        fetch('http://localhost:9001/api/v1/tags'),
        fetch('http://localhost:9001/api/v1/entries'),
      ]);
      const [tagsData, entriesData] = await Promise.all([
        tagsResponse.json(),
        entriesResponse.json(),
      ]);
      return {
        tagsOk: tagsResponse.ok,
        tagsCount: tagsData.data?.length || 0,
        entriesOk: entriesResponse.ok,
        entriesCount: entriesData.data?.length || 0,
        firstEntry: entriesData.data?.[0] || null,
      };
    });
  }

  async checkTags() {
    return browser.execute(async () => {
      const response = await fetch('http://localhost:9001/api/v1/tags');
      const data = await response.json();
      return {ok: response.ok, dataLength: data.data?.length || 0};
    });
  }
}

const BasePage = new Base();
export {BasePage};
