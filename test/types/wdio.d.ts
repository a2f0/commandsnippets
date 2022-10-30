declare namespace WebdriverIO {
  interface Element {
    waitAndRightClick: (this: WebdriverIO.Element) => Promise<void>;
  }
  interface Element {
    waitAndLeftClick: (this: WebdriverIO.Element) => Promise<void>;
  }
}
