export default class Base {
  get tagList() {
    return $('#tagList');
  }
  get tags() {
    return $$('div[id^="tag-"]');
  }
  get tagContext() {
    return $('#tagContextMenu-1');
  }
  get tag1() {
    return $('#tag-1');
  }
  get tagsEntriesList() {
    return $('#tagsEntriesList');
  }
  get tagsEntries() {
    return $$('div[id^="tagsEntries-"]');
  }
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
