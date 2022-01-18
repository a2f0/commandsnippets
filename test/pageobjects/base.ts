export default class Base {
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

  // entries menu
  get entriesMenu() {
    return $('#entries-menu');
  }
  get entriesMenuButton() {
    return $('#entries-menu-button');
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
    return browser.react$('TagList');
  }
  get tags() {
    return browser.react$$('Tag');
  }
  get tagListContextMenu() {
    return browser.react$('TagListContextMenu');
  }
  get tagListContextMenuNew() {
    return browser.react$('#tagListContextMenuNew');
  }
  get tagContextMenu1() {
    return $('#tagContextMenu-1');
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
