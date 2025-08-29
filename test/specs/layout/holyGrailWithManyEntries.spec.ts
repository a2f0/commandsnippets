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
      if (!window.setRuntimeEntriesOverride) {
        return {
          success: false,
          error: 'setRuntimeEntriesOverride not available',
        };
      }

      try {
        console.log(
          `✅ Setting MSW runtime override with ${mockData.data.length} entries for Holy Grail test`
        );

        // Use the new runtime override function
        window.setRuntimeEntriesOverride(mockData);

        console.log('✅ MSW runtime override set successfully');
        return {success: true, entriesCount: mockData.data.length};
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

    // Wait a bit and then force refresh the tag to trigger new API call
    await browser.pause(2000);

    // Try clicking on the tag again to force a refresh
    await BasePage.tag1.waitAndLeftClick();
    await browser.pause(3000);

    // Wait for many entries to load and verify we have a scrollable list
    await browser.waitUntil(
      async () => {
        const result = await browser.execute(() => {
          const entryElements = document.querySelectorAll(
            '[id^="tagsEntries-"]'
          );
          const allEntryElements = document.querySelectorAll('[id*="entry"]');
          const tagElements = document.querySelectorAll('[id^="tag-"]');
          const tag1Element = document.querySelector('#tag-1');
          const allActiveElements = document.querySelectorAll(
            '.active, .selected, [aria-selected="true"]'
          );

          // Debug: get all IDs that contain "entry"
          const allEntryIds = Array.from(
            document.querySelectorAll('[id*="entry"]')
          ).map(el => el.id);
          const allTagsEntriesIds = Array.from(
            document.querySelectorAll('[id*="tagsEntries"]')
          ).map(el => el.id);

          console.log(
            `Found ${entryElements.length} entry elements with id^="tagsEntries-"`
          );
          console.log(
            `Found ${allEntryElements.length} entry elements with id*="entry"`
          );
          console.log(`Found ${tagElements.length} tag elements`);
          console.log(`Tag 1 element: ${tag1Element?.textContent}`);
          console.log(`Active elements: ${allActiveElements.length}`);
          console.log('All entry IDs:', allEntryIds);
          console.log('All tagsEntries IDs:', allTagsEntriesIds);

          return {
            entriesCount: entryElements.length,
            allEntriesCount: allEntryElements.length,
            tagsCount: tagElements.length,
            tag1Text: tag1Element?.textContent || 'not found',
            activeElementsCount: allActiveElements.length,
            allEntryIds: allEntryIds,
            allTagsEntriesIds: allTagsEntriesIds,
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

    if (contentMetrics.isScrollable) {
      console.log('✅ Content is scrollable - many entries are present');
    } else {
      console.log(
        `✅ Content has substantial height (${contentMetrics.documentHeight}px) with ${contentMetrics.entryCount} entries in large viewport`
      );
    }

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
      expect(scrolledToolbarBottomEdge).toBeGreaterThan(viewport.height - 150);

      // Scroll back to top
      await browser.execute(() => {
        window.scrollTo(0, 0);
      });

      console.log('✅ Holy Grail layout verified with many entries:');
      console.log('   - Bottom toolbar stays at viewport bottom');
      console.log('   - Content is scrollable with 25+ entries');
      console.log('   - Layout maintains integrity during scroll');
    } else {
      console.log('✅ Holy Grail layout verified with many entries:');
      console.log('   - Bottom toolbar stays at viewport bottom');
      console.log('   - Content has substantial height with 25+ entries');
      console.log('   - Layout maintains integrity in large viewport');
    }
  });

  afterEach(async () => {
    // Reset MSW handlers after the test
    await browser.resetMSWHandlers();
  });
});
