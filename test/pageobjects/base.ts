export default class Base {
  // tags
  get tagList() {
    return $('#tagList');
  }
  get tags() {
    return $$('div[id^="tag-"]');
  }
  get tagContextMenu1() {
    return $('#tagContextMenu-1');
  }
  get tag1() {
    return $('#tag-1');
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
