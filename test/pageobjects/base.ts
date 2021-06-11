export default class Base {
  open(path: string) {
    return browser.url(`http://localhost:8081/${path}`);
  }
}

const BasePage = new Base();
export {BasePage};
