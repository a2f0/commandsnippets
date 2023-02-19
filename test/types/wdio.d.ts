declare namespace WebdriverIO {
  interface Element {
    waitAndRightClick: (this: WebdriverIO.Element) => Promise<void>;
    waitAndLeftClick: (this: WebdriverIO.Element) => Promise<void>;
  }
}
