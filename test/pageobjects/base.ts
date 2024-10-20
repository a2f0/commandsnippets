import {entrySearchMethod} from '../../src/lib/shared';
export default class Base {
  // home screen
  get tagLine(): ChainablePromiseElement {
    return $('#tagLine');
  }

  // file menu
  get githubAuthButton(): ChainablePromiseElement {
    return $('#githubAuthButton');
  }
  get googleAuthButton(): ChainablePromiseElement {
    return $('#googleAuthButton');
  }
  // file menu
  get fileMenu(): ChainablePromiseElement {
    return $('#file-menu');
  }
  get fileMenuButton(): ChainablePromiseElement {
    return $('#file-menu-button');
  }
  get fileMenuNewEntry(): ChainablePromiseElement {
    return $('#file-menu-new-entry');
  }
  get fileMenuLogout(): ChainablePromiseElement {
    return $('#file-menu-logout');
  }

  // entries menu
  get entriesMenu(): ChainablePromiseElement {
    return $('#entries-menu');
  }
  get entriesMenuButton(): ChainablePromiseElement {
    return $('#entries-menu-button');
  }
  get entriesMenuUntagged(): ChainablePromiseElement {
    return $(
      `#entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`
    );
  }

  // tags menu
  get tagsMenu(): ChainablePromiseElement {
    return $('#tags-menu');
  }
  get tagsMenuButton(): ChainablePromiseElement {
    return $('#tags-menu-button');
  }
  get tagsMenuSortDateCreatedAscending(): ChainablePromiseElement {
    return $('#tags-menu-sort-date-created-ascending');
  }
  get tagsMenuSortDateCreatedDescending(): ChainablePromiseElement {
    return $('#tags-menu-sort-date-created-descending');
  }

  // tags
  get tagList(): ChainablePromiseElement {
    return $('#tagList');
  }
  get tags(): ChainablePromiseElement {
    return $$('div[id^="tag-"]');
  }
  get tagListContextMenu(): ChainablePromiseElement {
    return $('#tagListContextMenu');
  }
  get tagNewBottomTextField(): ChainablePromiseElement {
    return $('#tagNewBottomTextField');
  }
  get tagNewBottom(): ChainablePromiseElement {
    return $('#tagNewBottom');
  }
  get tagNewBottomCancel(): ChainablePromiseElement {
    return $('#tagNewBottomCancel');
  }
  get tagNewBottomSave(): ChainablePromiseElement {
    return $('#tagNewBottomSave');
  }
  get tagListContextMenuNew(): ChainablePromiseElement {
    return $('#tagListContextMenuNew');
  }
  get tagContextMenu1(): ChainablePromiseElement {
    return $('#tagContextMenu-1');
  }
  get tagContextMenu1DeleteTagMenuItem(): ChainablePromiseElement {
    return $('#tagContextMenu1DeleteTagMenuItem');
  }
  get tagContextMenu1DeleteTagDialog(): ChainablePromiseElement {
    return $('#tagContextMenu1DeleteTagDialog');
  }
  get tagContextMenu1DeleteTagDialogDeleteButton(): ChainablePromiseElement {
    return $('#tagContextMenu1DeleteTagDialogDeleteButton');
  }
  get tagContextMenu1DeleteTagDialogCancelButton(): ChainablePromiseElement {
    return $('#tagContextMenu1DeleteTagDialogCancelButton');
  }
  get tag1(): ChainablePromiseElement {
    return $('#tag-1');
  }
  get tag2(): ChainablePromiseElement {
    return $('#tag-2');
  }
  get tagSearch(): ChainablePromiseElement {
    return $('#tagSearch');
  }

  // entries
  get entryNewTop(): ChainablePromiseElement {
    return $('#textEntryNewTop');
  }
  get entryNewTopSubject(): ChainablePromiseElement {
    return $('#textEntryNewTopSubject');
  }
  get entryNewTopBody(): ChainablePromiseElement {
    return $('#textEntryNewTopBody');
  }
  get entryNewTopCancel(): ChainablePromiseElement {
    return $('#textEntryNewTopCancel');
  }
  get entryNewTopSave(): ChainablePromiseElement {
    return $('#textEntryNewTopSave');
  }
  get entryNewBottom(): ChainablePromiseElement {
    return $('#textEntryNewBottom');
  }
  get entryNewBottomSubject(): ChainablePromiseElement {
    return $('#textEntryNewBottomSubject');
  }
  get entryNewBottomBody(): ChainablePromiseElement {
    return $('#textEntryNewBottomBody');
  }
  get entryNewBottomSave(): ChainablePromiseElement {
    return $('#textEntryNewBottomSave');
  }
  get entryNewBottomCancel(): ChainablePromiseElement {
    return $('#textEntryNewBottomCancel');
  }
  get entryListContextMenu(): ChainablePromiseElement {
    return $('#entryListContextMenu');
  }
  get entryListContextMenuNewEntry(): ChainablePromiseElement {
    return $('#entryListContextMenuNewEntry');
  }
  get tagsEntriesList(): ChainablePromiseElement {
    return $('#tagsEntriesList');
  }
  get tagsEntries(): ChainablePromiseElement {
    return $$('div[id^="tagsEntries-"]');
  }
  get entry1(): ChainablePromiseElement {
    return $('#tagsEntries-1');
  }
  get entryBodyOuterDiv3(): ChainablePromiseElement {
    return $('#entryBodyOuterDiv3');
  }
  get tagsEntriesContextMenu1(): ChainablePromiseElement {
    return $('#tagsEntriesContextMenu-1');
  }
  get tagsEntriesContextMenu1Edit(): ChainablePromiseElement {
    return $('#tagsEntriesContextMenu1Edit');
  }
  get tagsEntriesContextMenu1Untag(): ChainablePromiseElement {
    return $('#tagsEntriesContextMenu1Untag');
  }
  get tagsEntriesContextMenu1Delete(): ChainablePromiseElement {
    return $('#tagsEntriesContextMenu1Delete');
  }
  get textEntryEdit1(): ChainablePromiseElement {
    return $('#textEntryEdit1');
  }
  get textEntryEdit1Subject(): ChainablePromiseElement {
    return $('#textEntryEdit1Subject');
  }
  get textEntryEdit1Body(): ChainablePromiseElement {
    return $('#textEntryEdit1Body');
  }
  get textEntryEdit1Save(): ChainablePromiseElement {
    return $('#textEntryEdit1Save');
  }
  get textEntryEdit1Cancel(): ChainablePromiseElement {
    return $('#textEntryEdit1Cancel');
  }
  get tagsEntries1(): ChainablePromiseElement {
    return $('#tagsEntries-1');
  }
  get entrySearch(): ChainablePromiseElement {
    return $('#textEntrySearch');
  }
  open(path: string): ReturnType<WebdriverIO.Browser['url']> {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
