import {browser, expect} from '@wdio/globals';
import {BasePage} from '../../pageobjects/base';

// Chrome's screenshot capture can restore a stale viewport after a concurrent
// resize. Keep the video reporter's captures and viewport changes in order.
const screenshots = new Set<Promise<unknown>>();
let resizing: Promise<void> | undefined;
const resizeViewport = async (width: number) => {
  while (screenshots.size) {
    await browser.waitUntil(() => screenshots.size === 0, {
      timeoutMsg: 'Video screenshots did not finish before the viewport resize',
    });
  }
  resizing = browser.setViewport({width, height: 800});
  try {
    await resizing;
  } finally {
    resizing = undefined;
  }
};

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
  // Keep the matching snapshot: another WebDriver round trip can observe a
  // different resize frame between the wait and the alignment assertions.
  const layout = await browser.waitUntil(
    async () => {
      const snapshot = await dimensions();
      return Math.abs(snapshot.sidebar.width - width) < 0.5 && snapshot;
    },
    {timeoutMsg: `Sidebar did not reach ${width}px`}
  );
  expect(layout.sidebar.width).toBeCloseTo(width, 0);
  expect(layout.search.right).toBeCloseTo(layout.sidebar.right, 0);
  expect(layout.entries.left).toBeGreaterThanOrEqual(layout.sidebar.right);
};

describe('Resizable tag sidebar', () => {
  let captureDescriptor: PropertyDescriptor | undefined;
  let capturedFrames = 0;
  const observeScreenshots = () => {
    // @wdio/globals forwards reads only. The real instance's protocol method
    // is configurable but not writable, so preserve and replace its descriptor.
    captureDescriptor = Object.getOwnPropertyDescriptor(
      globalThis.browser,
      'browsingContextCaptureScreenshot'
    );
    if (!captureDescriptor) throw new Error('Missing screenshot command');
    const capture = browser.browsingContextCaptureScreenshot;
    Object.defineProperty(
      globalThis.browser,
      'browsingContextCaptureScreenshot',
      {
        configurable: true,
        value: (parameters: Parameters<typeof capture>[0]) => {
          const start = () => {
            const result = capture(parameters).then(frame => {
              capturedFrames++;
              return frame;
            });
            screenshots.add(result);
            const finished = () => screenshots.delete(result);
            void result.then(finished, finished);
            return result;
          };
          return resizing ? resizing.then(start) : start();
        },
      }
    );
  };
  const restoreScreenshots = () => {
    if (!captureDescriptor) return;
    Object.defineProperty(
      globalThis.browser,
      'browsingContextCaptureScreenshot',
      captureDescriptor
    );
    captureDescriptor = undefined;
    screenshots.clear();
  };
  after(restoreScreenshots);

  it('aligns the narrower search, resizes and remembers the width within viewport limits', async () => {
    await resizeViewport(1200);
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

    // Observe the active page's resize sequence. Captures from navigation may
    // outlive their document and must not hold subsequent resizes open.
    observeScreenshots();
    await dragTo(2);
    await expectAligned(140);
    await dragTo(1000);
    await expectAligned(480);

    await resizeViewport(800);
    // Browser/OS viewport sizing can differ from the requested dimensions.
    // Check the actual space left for the entries and the right drawer.
    const narrowViewport = await browser.waitUntil(
      async () => {
        const width = await browser.execute(() => window.innerWidth);
        return width > 620 && width < 960 && width;
      },
      {timeoutMsg: 'The viewport did not shrink between 620px and 960px'}
    );
    await expectAligned(narrowViewport - 480);
    const separator = await browser.$(
      '[role="separator"][aria-controls="tagSidebar"]'
    );
    await separator.click();
    await resizeViewport(1200);
    await expectAligned(480);
    // The video reporter must have exercised the wrapper, not just the resizes.
    expect(capturedFrames).toBeGreaterThan(0);
    restoreScreenshots();

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
