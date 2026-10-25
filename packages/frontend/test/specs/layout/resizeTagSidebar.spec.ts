import {browser, expect} from '@wdio/globals';
import {BasePage} from '../../pageobjects/base';

const dimensions = () =>
  browser.execute(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const {left, right, width} = element.getBoundingClientRect();
      return {left, right, width};
    };
    return {
      sidebar: rect('#tagSidebar'),
      search: rect('#tagSearchContainer .MuiTextField-root'),
      entries: rect('#tagsEntriesList'),
    };
  });

const dragTo = async (x: number) => {
  const separator = await browser.$(
    '[role="separator"][aria-controls="tagSidebar"]'
  );
  const {x: left, y} = await separator.getLocation();
  await browser
    .action('pointer')
    .move({x: left + 3, y: y + 100})
    .down()
    .move({x, y: y + 100, duration: 250})
    .up()
    .perform();
};

const expectAligned = async (width: number) => {
  await browser.waitUntil(
    async () => Math.abs((await dimensions()).sidebar.width - width) < 0.5,
    {timeoutMsg: `Sidebar did not settle at ${width}px`}
  );
  const layout = await dimensions();
  expect(layout.sidebar.width).toBeCloseTo(width, 0);
  expect(layout.search.right).toBeCloseTo(layout.sidebar.right, 0);
  expect(layout.entries.left).toBeGreaterThanOrEqual(layout.sidebar.right);
};

describe('Resizable tag sidebar', () => {
  it('aligns the narrower search, resizes and remembers the width within viewport limits', async () => {
    await browser.setViewport({width: 1200, height: 800});
    await BasePage.open('');
    await browser.login();
    await BasePage.open('');
    await BasePage.tagList.waitForDisplayed();
    await BasePage.tagsEntriesList.waitForDisplayed();
    await expectAligned(200);
    expect((await dimensions()).search.width).toBeCloseTo(185, 0);

    await dragTo(317);
    await expectAligned(320);
    // The pointer has left the original handle: capture must finish the drag.
    await browser.action('pointer').move({x: 600, y: 200}).perform();
    await expectAligned(320);
    await browser.refresh();
    await browser.waitForMSW();
    await BasePage.tagList.waitForDisplayed();
    await expectAligned(320);

    await dragTo(2);
    await expectAligned(140);
    await dragTo(1000);
    await expectAligned(480);

    await browser.setViewport({width: 800, height: 800});
    // Browser/OS viewport sizing can differ from the requested dimensions.
    // Check the actual space left for the entries and the right drawer.
    const narrowViewport = await browser.execute(() => window.innerWidth);
    expect(narrowViewport).toBeLessThan(960);
    await expectAligned(narrowViewport - 480);
    const separator = await browser.$(
      '[role="separator"][aria-controls="tagSidebar"]'
    );
    await separator.click();
    await browser.setViewport({width: 1200, height: 800});
    await expectAligned(480);

    await separator.doubleClick();
    await expectAligned(200);
    await browser.keys('ArrowRight');
    await expectAligned(210);
    await expect(separator).toBeFocused();
    await browser.keys('ArrowLeft');
    await expectAligned(200);
    await browser.keys('Home');
    await expectAligned(140);
    await browser.keys('End');
    await expectAligned(480);
    await browser.keys('Enter');
    await expectAligned(200);
    await browser.keys('Escape');
    await expect(BasePage.tagSearch).toBeFocused();

    // A cancelled drag restores the last saved width.
    await browser
      .action('pointer')
      .move({x: 197, y: 150})
      .down()
      .move({x: 317, y: 150, duration: 250})
      .perform(true);
    await expectAligned(320);
    await browser.execute(() => {
      document
        .querySelector('[aria-controls="tagSidebar"]')
        ?.dispatchEvent(new PointerEvent('pointercancel', {bubbles: true}));
    });
    await browser.releaseActions();
    await expectAligned(200);

    // Older or malformed saved preferences fall back safely, in either theme.
    for (const invalidWidth of [null, 'wide']) {
      await browser.execute((tagSidebarWidth: string | null) => {
        localStorage.setItem(
          'commandsnippets-test',
          JSON.stringify({
            state: {
              loggedInUser: 'test',
              selectedTheme: 'lightTheme',
              tagSidebarWidth,
            },
            version: 0,
          })
        );
      }, invalidWidth);
      await browser.refresh();
      await browser.waitForMSW();
      await BasePage.tagList.waitForDisplayed();
      await expectAligned(200);
    }
  });
});
