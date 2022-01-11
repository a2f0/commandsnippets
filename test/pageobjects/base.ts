export default class Base {
  // menu
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
  get tagContextMenu1() {
    return $('#tagContextMenu-1');
  }
  get tag1() {
    return $('#tag-1');
  }
  get tag2() {
    return $('#tag-2');
  }

  // tagsEntries
  get tagsEntriesList() {
    return $('#tagsEntriesList');
  }
  get tagsEntries() {
    return $$('div[id^="tagsEntries-"]');
  }
  get tagsEntriesContextMenu1() {
    return $('#tagsEntriesContextMenu-1');
  }
  get tagsEntries1() {
    return $('#tagsEntries-1');
  }
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
