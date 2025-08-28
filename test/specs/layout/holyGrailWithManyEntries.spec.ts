import {$$, browser, expect} from '@wdio/globals';
import type {SetupWorker} from 'msw/browser';

import {manyEntriesResponse} from '../../mocks/entries/manyEntriesResponse';
import {BasePage} from '../../pageobjects/base';

describe('Holy Grail Layout with Many Entries', () => {
  it('should keep bottom bar at bottom of screen with many entries', async () => {
    // Navigate to page and login
    await BasePage.open('');
    await browser.login();

    // Override MSW handlers to use manyEntriesResponse mock
    await browser.execute(mockData => {
      if (window.__MSW_WORKER__ && window.msw) {
        const {http, HttpResponse} = window.msw;

        console.log(
          `✅ Overriding MSW with ${mockData.data.length} entries for Holy Grail test`
        );

        const apiBaseUrls = [
          'http://localhost:9001/api/v1',
          'https://api.staging.tearleads.com/api/v1',
          'https://api.tearleads.com/api/v1',
        ];

        const newHandlers = [];
        for (const baseUrl of apiBaseUrls) {
          // Override entries by tag endpoint with many entries
          newHandlers.push(
            http.get(
              `${baseUrl}/tags/:tagId/entries`,
              ({params}: {params: Record<string, string | string[]>}) => {
                const tagId = `${params['tagId']}`;
                console.log(
                  `✅ MSW returning ${mockData.data.length} entries for tag ${tagId}`
                );
                if (tagId === '1') {
                  return HttpResponse.json(mockData, {status: 200});
                }
                return HttpResponse.json(
                  {
                    data: [],
                    included: [],
                    links: {next: null},
                  },
                  {status: 200}
                );
              }
            ),
            // Also override general entries endpoint
            http.get(`${baseUrl}/entries`, () => {
              console.log(
                `✅ MSW returning ${mockData.data.length} entries for general entries`
              );
              return HttpResponse.json(mockData, {status: 200});
            })
          );
        }

        window.__MSW_WORKER__.use(
          ...(newHandlers as Parameters<SetupWorker['use']>)
        );
        console.log('✅ MSW handlers updated with many entries mock');
      } else {
        console.warn('❌ MSW not available for handler override');
      }
    }, manyEntriesResponse);

    // Navigate to the test page to trigger the MSW handlers
    await BasePage.open('test');

    // Wait for elements to load
    await BasePage.tagList.waitForDisplayed({timeout: 10000});
    await BasePage.tagsEntriesList.waitForDisplayed({timeout: 10000});

    // Click on the first tag to load the many entries
    await BasePage.tag1.waitAndLeftClick();

    // Wait for many entries to load and verify we have a scrollable list
    await browser.waitUntil(
      async () => {
        const entriesCount = await browser.execute(() => {
          const entryElements = document.querySelectorAll(
            '[id^="tagsEntries-"]'
          );
          console.log(`Found ${entryElements.length} entry elements`);
          return entryElements.length;
        });
        return entriesCount >= 20; // Wait for most of the entries to be rendered
      },
      {
        timeout: 15000,
        timeoutMsg:
          'Expected many entries to be loaded from manyEntriesResponse mock',
      }
    );

    // ASSERTION: Verify entry count matches mock data
    const finalEntriesCount = await browser.execute(() => {
      const entryElements = document.querySelectorAll('[id^="tagsEntries-"]');
      return entryElements.length;
    });
    expect(finalEntriesCount).toBe(manyEntriesResponse.data.length);
    console.log(
      `✅ Entry count matches mock data: ${finalEntriesCount}/${manyEntriesResponse.data.length}`
    );

    // Get viewport dimensions for Holy Grail assertions
    const viewport = await browser.getWindowSize();
    console.log(`Viewport: ${viewport.width}x${viewport.height}`);

    // Find the bottom toolbar (AppBar with marginTop: auto)
    const appBars = await $$('.MuiAppBar-root');
    const appBarsLength = await appBars.length;
    expect(appBarsLength).toBeGreaterThanOrEqual(2);

    // biome-ignore lint/suspicious/noImplicitAnyLet: WebDriverIO element types are complex and dynamic
    let bottomToolbar;

    // Find the bottom toolbar by checking for marginTop: auto (Holy Grail pattern)
    for (const appBar of appBars) {
      const marginTop = await browser.execute((el: HTMLElement) => {
        return window.getComputedStyle(el).marginTop;
      }, appBar);

      if (marginTop === 'auto') {
        bottomToolbar = appBar;
        break;
      }
    }

    // Fallback: use the last AppBar if none found with marginTop: auto
    if (!bottomToolbar && appBarsLength > 0) {
      bottomToolbar = appBars[appBarsLength - 1];
    }

    expect(bottomToolbar).toBeDefined();
    if (!bottomToolbar) {
      throw new Error('Bottom toolbar not found');
    }

    // Test Holy Grail layout with many entries
    const resolvedBottomToolbar = await bottomToolbar;
    const bottomToolbarLocation = await (
      resolvedBottomToolbar as unknown as WebdriverIO.Element
    ).getLocation();
    const bottomToolbarSize = await (
      resolvedBottomToolbar as unknown as WebdriverIO.Element
    ).getSize();
    const toolbarBottomEdge =
      bottomToolbarLocation.y + bottomToolbarSize.height;

    console.log(
      `Bottom toolbar: y=${bottomToolbarLocation.y}, height=${bottomToolbarSize.height}`
    );
    console.log(
      `Bottom edge: ${toolbarBottomEdge} (${viewport.height - toolbarBottomEdge}px from viewport bottom)`
    );

    // ASSERTION 1: Bottom toolbar should be positioned at the bottom of viewport
    // The Holy Grail layout should keep it within reasonable distance of viewport bottom
    expect(toolbarBottomEdge).toBeGreaterThan(viewport.height - 150);

    // ASSERTION 2: Verify the bottom toolbar has Holy Grail layout properties
    const bottomToolbarStyles = await browser.execute(
      (el: HTMLElement) => {
        const computedStyle = window.getComputedStyle(el);
        return {
          position: computedStyle.position,
          marginTop: computedStyle.marginTop,
        };
      },
      resolvedBottomToolbar as unknown as WebdriverIO.Element
    );

    expect(bottomToolbarStyles.position).toBe('sticky');

    // ASSERTION 3: Check if content is actually scrollable (proving we have many entries)
    const isScrollable = await browser.execute(() => {
      const body = document.body;
      const html = document.documentElement;
      const documentHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      const viewportHeight = window.innerHeight;
      return documentHeight > viewportHeight;
    });

    expect(isScrollable).toBe(true);
    console.log('✅ Content is scrollable - many entries are present');

    // ASSERTION 4: Test scroll behavior - toolbar should remain at bottom during scroll
    // Scroll to middle of content
    await browser.execute(() => {
      const scrollAmount = Math.floor(window.innerHeight / 2);
      window.scrollTo(0, scrollAmount);
    });

    // Verify toolbar is still at bottom after scroll
    const scrolledToolbarLocation = await (
      resolvedBottomToolbar as unknown as WebdriverIO.Element
    ).getLocation();
    const scrolledToolbarBottomEdge =
      scrolledToolbarLocation.y + bottomToolbarSize.height;
    expect(scrolledToolbarBottomEdge).toBeGreaterThan(viewport.height - 150);

    // Scroll back to top
    await browser.execute(() => {
      window.scrollTo(0, 0);
    });

    console.log('✅ Holy Grail layout verified with many entries:');
    console.log('   - Bottom toolbar stays at viewport bottom');
    console.log('   - Content is scrollable with 25+ entries');
    console.log('   - Layout maintains integrity during scroll');
  });

  afterEach(async () => {
    // Reset MSW handlers after the test
    await browser.resetMSWHandlers();
  });
});
