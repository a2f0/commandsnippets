import {$$, browser, expect} from '@wdio/globals';

import {manyEntriesResponse} from '../../mocks/entries/manyEntriesResponse';
import {BasePage} from '../../pageobjects/base';

describe('Holy Grail Layout with Many Entries', () => {
  it('should keep bottom bar at bottom of screen with many entries', async () => {
    // Navigate to page and login
    await BasePage.open('');
    await browser.login();

    // Navigate to the test page first
    await BasePage.open('test');

    // Override MSW handlers to use manyEntriesResponse mock
    const mswResult = await browser.execute(mockData => {
      if (!window.setRuntimeEntriesOverride) {
        return {
          success: false,
          error: 'setRuntimeEntriesOverride not available',
        };
      }

      try {
        window.setRuntimeEntriesOverride(mockData);
        return {success: true, entriesCount: mockData.data.length};
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {success: false, error: errorMessage};
      }
    }, manyEntriesResponse);

    if (!mswResult.success) {
      throw new Error(`Failed to override MSW handlers: ${mswResult.error}`);
    }

    // Wait for elements to load
    await BasePage.tagList.waitForDisplayed({timeout: 10000});
    await BasePage.tagsEntriesList.waitForDisplayed({timeout: 10000});

    // Click on the first tag to load the many entries
    await BasePage.tag1.waitAndLeftClick();

    // Wait for many entries to load
    await browser.waitUntil(
      async () => {
        const entriesCount = await browser.execute(() => {
          const entryElements = document.querySelectorAll(
            '[id^="tagsEntries-"]'
          );
          return entryElements.length;
        });
        return entriesCount >= 20;
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

    // Get viewport dimensions for Holy Grail assertions
    const viewport = await browser.getWindowSize();

    // Find the bottom toolbar (AppBar with marginTop: auto)
    const appBars = await $$('.MuiAppBar-root');
    const appBarsLength = await appBars.length;
    expect(appBarsLength).toBeGreaterThanOrEqual(2);

    // Find the bottom toolbar by checking for marginTop: auto (Holy Grail pattern)
    // Optimized to use a single browser.execute call instead of multiple round-trips
    const bottomToolbarIndex = await browser.execute(selector => {
      const appBars = Array.from(document.querySelectorAll(selector));
      const index = appBars.findIndex(
        appBar => window.getComputedStyle(appBar).marginTop === 'auto'
      );

      if (index !== -1) {
        return index;
      }

      // Fallback: use the last AppBar if none found with marginTop: auto
      return appBars.length > 0 ? appBars.length - 1 : -1;
    }, '.MuiAppBar-root');

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

    // ASSERTION 1: Bottom toolbar should be positioned at the bottom of viewport
    // The Holy Grail layout should keep it within reasonable distance of viewport bottom
    expect(toolbarBottomEdge).toBeGreaterThan(viewport.height - 200);

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

    // ASSERTION 3: Check if content extends beyond a reasonable height (proving we have many entries)
    // In very large viewports, content might fit without scrolling, so we check content height instead
    const contentMetrics = await browser.execute(() => {
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
      const isScrollable = documentHeight > viewportHeight;

      // Count actual entry elements to verify we have many entries loaded
      const entryElements = document.querySelectorAll('[id^="tagsEntries-"]');

      return {
        documentHeight,
        viewportHeight,
        isScrollable,
        entryCount: entryElements.length,
        contentExtendsReasonably: documentHeight > 1000, // Content should be substantial
      };
    });

    // Either content should be scrollable OR we should have substantial content height with many entries
    const hasSubstantialContent =
      contentMetrics.isScrollable ||
      (contentMetrics.contentExtendsReasonably &&
        contentMetrics.entryCount >= 20);

    expect(hasSubstantialContent).toBe(true);

    // Content validation passed - either scrollable or has substantial height

    // ASSERTION 4: Test scroll behavior - toolbar should remain at bottom during scroll
    // Only test scrolling if content is actually scrollable
    if (contentMetrics.isScrollable) {
      // Scroll to middle of content
      await browser.execute(() => {
        const scrollAmount = Math.floor(window.innerHeight / 2);
        window.scrollTo(0, scrollAmount);
      });

      // Verify toolbar is still at bottom after scroll
      const scrolledToolbarLocation = await bottomToolbar.getLocation();
      const scrolledToolbarBottomEdge =
        scrolledToolbarLocation.y + bottomToolbarSize.height;
      expect(scrolledToolbarBottomEdge).toBeGreaterThan(viewport.height - 200);

      // Scroll back to top
      await browser.execute(() => {
        window.scrollTo(0, 0);
      });

      // Test completed successfully
    } else {
      // Test completed successfully for large viewport
    }
  });

  afterEach(async () => {
    // Reset MSW handlers after the test
    await browser.resetMSWHandlers();
  });
});
