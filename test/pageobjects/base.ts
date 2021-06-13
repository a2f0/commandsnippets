export default class Base {
  get tagList() {
    return $('#tagList');
  }
  get tagDivs() {
    return $$('#tagList > div');
  }
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
