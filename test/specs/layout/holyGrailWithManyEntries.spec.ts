import {$$, browser, expect} from '@wdio/globals';

import {manyEntriesResponse} from '../../mocks/entries/manyEntriesResponse';
import {BasePage} from '../../pageobjects/base';

describe('Holy Grail Layout with Many Entries', () => {
  it('should keep bottom bar at bottom of screen with many entries', async () => {
    // Navigate to page and login
    await BasePage.open('');
    await browser.login();

    // Override MSW handlers to use manyEntriesResponse mock
    const mswResult = await browser.execute(mockData => {
      if (!window.__MSW_WORKER__) {
        return {success: false, error: 'MSW worker not available'};
      }
      if (!window.msw) {
        return {success: false, error: 'MSW utilities not available'};
      }

      try {
        const {http, HttpResponse} = window.msw;

        console.log(
          `✅ Overriding MSW with ${mockData.data.length} entries for Holy Grail test`
        );

        // Only override localhost:9001 since that's what the app uses in test mode
        const baseUrl = 'http://localhost:9001/api/v1';

        // Override entries by tag endpoint with many entries - this is the key endpoint
        const tagEntriesHandler = http.get(
          `${baseUrl}/tags/:tagId/entries`,
          ({params}) => {
            const tagId = `${params['tagId']}`;
            console.log(
              `✅ MSW intercepted /tags/${tagId}/entries - returning ${mockData.data.length} entries`
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
        );

        // Also override general entries endpoint
        const entriesHandler = http.get(`${baseUrl}/entries`, () => {
          console.log(
            `✅ MSW intercepted /entries - returning ${mockData.data.length} entries`
          );
          return HttpResponse.json(mockData, {status: 200});
        });

        // Use the handlers to override existing ones
        window.__MSW_WORKER__.use(tagEntriesHandler, entriesHandler);
        console.log('✅ MSW handlers updated with many entries mock');
        return {success: true, handlersAdded: 2};
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {success: false, error: errorMessage};
      }
    }, manyEntriesResponse);

    console.log('MSW Override Result:', mswResult);
    if (!mswResult.success) {
      throw new Error(`Failed to override MSW handlers: ${mswResult.error}`);
    }

    // Navigate to the test page to trigger the MSW handlers
    await BasePage.open('test');

    // Wait for elements to load
    await BasePage.tagList.waitForDisplayed({timeout: 10000});
    await BasePage.tagsEntriesList.waitForDisplayed({timeout: 10000});

    // Click on the first tag to load the many entries
    await BasePage.tag1.waitAndLeftClick();

    // Wait a bit for the request to be made
    await browser.pause(1000);

    // Wait for many entries to load and verify we have a scrollable list
    await browser.waitUntil(
      async () => {
        const result = await browser.execute(() => {
          const entryElements = document.querySelectorAll(
            '[id^="tagsEntries-"]'
          );
          const tagElements = document.querySelectorAll('[id^="tag-"]');
          const tag1Element = document.querySelector('#tag-1');
          const allActiveElements = document.querySelectorAll(
            '.active, .selected, [aria-selected="true"]'
          );
          console.log(`Found ${entryElements.length} entry elements`);
          console.log(`Found ${tagElements.length} tag elements`);
          console.log(`Tag 1 element: ${tag1Element?.textContent}`);
          console.log(`Active elements: ${allActiveElements.length}`);
          return {
            entriesCount: entryElements.length,
            tagsCount: tagElements.length,
            tag1Text: tag1Element?.textContent || 'not found',
            activeElementsCount: allActiveElements.length,
          };
        });
        console.log('Waiting for entries:', result);
        return result.entriesCount >= 20; // Wait for most of the entries to be rendered
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

    let bottomToolbarIndex = -1;

    // Find the bottom toolbar by checking for marginTop: auto (Holy Grail pattern)
    for (let i = 0; i < appBarsLength; i++) {
      const appBar = appBars[i];
      const marginTop = await browser.execute((el: HTMLElement | undefined) => {
        if (!el) return '';
        return window.getComputedStyle(el).marginTop;
      }, appBar);

      if (marginTop === 'auto') {
        bottomToolbarIndex = i;
        break;
      }
    }

    // Fallback: use the last AppBar if none found with marginTop: auto
    if (bottomToolbarIndex === -1 && appBarsLength > 0) {
      bottomToolbarIndex = appBarsLength - 1;
    }

    expect(bottomToolbarIndex).toBeGreaterThanOrEqual(0);
    if (bottomToolbarIndex === -1) {
      throw new Error('Bottom toolbar not found');
    }

    const bottomToolbar = appBars[bottomToolbarIndex];
    if (!bottomToolbar) {
      throw new Error('Bottom toolbar element not found');
    }

    // Test Holy Grail layout with many entries
    const bottomToolbarLocation = await bottomToolbar.getLocation();
    const bottomToolbarSize = await bottomToolbar.getSize();
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
      (el: HTMLElement | undefined) => {
        if (!el) return {position: '', marginTop: ''};
        const computedStyle = window.getComputedStyle(el);
        return {
          position: computedStyle.position,
          marginTop: computedStyle.marginTop,
        };
      },
      bottomToolbar
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
    const scrolledToolbarLocation = await bottomToolbar.getLocation();
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
