export default class Base {
  get tagList() {
    return $('#tagList');
  }
  get tagDivs() {
    return $$('#tagList > div');
  }
  get tagContext() {
    return $('#tagContextMenu-1');
  }
  get tagParent() {
    return $('#tagParent-1');
  }
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
