import {entrySearchMethod} from '../../src/lib/shared';
export default class Base {
  // file menu
  get githubAuthButton() {
    return $('#githubAuthButton');
  }
  get googleAuthButton() {
    return $('#googleAuthButton');
  }
  // file menu
  get fileMenu() {
    return $('#file-menu');
  }
  get fileMenuButton() {
    return $('#file-menu-button');
  }
  get fileMenuNewEntry() {
    return $('#file-menu-new-entry');
  }
  get fileMenuLogout() {
    return $('#file-menu-logout');
  }

  // entries menu
  get entriesMenu() {
    return $('#entries-menu');
  }
  get entriesMenuButton() {
    return $('#entries-menu-button');
  }
  get entriesMenuUntagged() {
    return $(
      `#entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`
    );
  }

  // tags menu
  get tagsMenu() {
    return $('#tags-menu');
  }
  get tagsMenuButton() {
    return $('#tags-menu-button');
  }
  get tagsMenuSortDateCreatedAscending() {
    return $('#tags-menu-sort-date-created-ascending');
  }
  get tagsMenuSortDateCreatedDescending() {
    return $('#tags-menu-sort-date-created-descending');
  }

  // tags
  get tagList() {
    return $('#tagList');
  }
  get tags() {
    return $$('div[id^="tag-"]');
  }
  get tagListContextMenu() {
    return $('#tagListContextMenu');
  }
  get tagNewBottomTextField() {
    return $('#tagNewBottomTextField');
  }
  get tagNewBottom() {
    return $('#tagNewBottom');
  }
  get tagNewBottomCancel() {
    return $('#tagNewBottomCancel');
  }
  get tagNewBottomSave() {
    return $('#tagNewBottomSave');
  }
  get tagListContextMenuNew() {
    return $('#tagListContextMenuNew');
  }
  get tagContextMenu1() {
    return $('#tagContextMenu-1');
  }
  get tagContextMenu1DeleteTagMenuItem() {
    return $('#tagContextMenu1DeleteTagMenuItem');
  }
  get tagContextMenu1DeleteTagDialog() {
    return $('#tagContextMenu1DeleteTagDialog');
  }
  get tagContextMenu1DeleteTagDialogDeleteButton() {
    return $('#tagContextMenu1DeleteTagDialogDeleteButton');
  }
  get tagContextMenu1DeleteTagDialogCancelButton() {
    return $('#tagContextMenu1DeleteTagDialogCancelButton');
  }
  get tag1() {
    return $('#tag-1');
  }
  get tag2() {
    return $('#tag-2');
  }
  get tagSearch() {
    return $('#tagSearch');
  }

  // entries
  get entryNewTop() {
    return $('#textEntryNewTop');
  }
  get entryNewTopSubject() {
    return $('#textEntryNewTopSubject');
  }
  get entryNewTopBody() {
    return $('#textEntryNewTopBody');
  }
  get entryNewTopCancel() {
    return $('#textEntryNewTopCancel');
  }
  get entryNewTopSave() {
    return $('#textEntryNewTopSave');
  }
  get entryNewBottom() {
    return $('#textEntryNewBottom');
  }
  get entryNewBottomSubject() {
    return $('#textEntryNewBottomSubject');
  }
  get entryNewBottomBody() {
    return $('#textEntryNewBottomBody');
  }
  get entryNewBottomSave() {
    return $('#textEntryNewBottomSave');
  }
  get entryNewBottomCancel() {
    return $('#textEntryNewBottomCancel');
  }
  get entryListContextMenu() {
    return $('#entryListContextMenu');
  }
  get entryListContextMenuNewEntry() {
    return $('#entryListContextMenuNewEntry');
  }
  get tagsEntriesList() {
    return $('#tagsEntriesList');
  }
  get tagsEntries() {
    return $$('div[id^="tagsEntries-"]');
  }
  get entry1() {
    return $('#tagsEntries-1');
  }
  get entryBodyOuterDiv3() {
    return $('#entryBodyOuterDiv3');
  }
  get tagsEntriesContextMenu1() {
    return $('#tagsEntriesContextMenu-1');
  }
  get tagsEntriesContextMenu1Edit() {
    return $('#tagsEntriesContextMenu1Edit');
  }
  get tagsEntriesContextMenu1Untag() {
    return $('#tagsEntriesContextMenu1Untag');
  }
  get tagsEntriesContextMenu1Delete() {
    return $('#tagsEntriesContextMenu1Delete');
  }
  get textEntryEdit1() {
    return $('#textEntryEdit1');
  }
  get textEntryEdit1Subject() {
    return $('#textEntryEdit1Subject');
  }
  get textEntryEdit1Body() {
    return $('#textEntryEdit1Body');
  }
  get textEntryEdit1Save() {
    return $('#textEntryEdit1Save');
  }
  get textEntryEdit1Cancel() {
    return $('#textEntryEdit1Cancel');
  }
  get tagsEntries1() {
    return $('#tagsEntries-1');
  }
  get entrySearch() {
    return $('#textEntrySearch');
  }
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
