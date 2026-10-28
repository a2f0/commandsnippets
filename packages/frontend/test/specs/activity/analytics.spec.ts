import {$, browser, expect} from '@wdio/globals';
import {BasePage} from '../../pageobjects/base';

describe('Analytics', () => {
  it('renders grayscale charts and usable filters on desktop and mobile', async () => {
    await browser.setViewport({width: 1100, height: 850});
    await BasePage.signIn('test?entries=all');
    await $('#tagsEntries-1').waitForDisplayed();
    await browser.execute(async () => {
      for (let index = 0; index < 4; index += 1) {
        const response = await fetch(
          'http://localhost:9001/api/v1/entry_reuses',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/vnd.api+json',
              'X-Data-Version': '1',
            },
            body: JSON.stringify({
              data: {
                type: 'TextEntryReused',
                attributes: {client_id: `analytics-${index}`},
                relationships: {
                  text_entry: {
                    data: {type: 'TextEntry', id: index % 2 ? '1' : '2'},
                  },
                },
              },
            }),
          }
        );
        if (!response.ok) throw new Error(`Seed failed: ${response.status}`);
      }
    });
    await $('#view-menu-button').click();
    await $('#view-menu-analytics').click();
    await $('#analyticsPage').waitForDisplayed();
    await $('#analyticsPage [role="combobox"]').click();
    await $('[role="option"][data-value="reused"]').click();
    await $('#analyticsPage svg[role="img"]').waitForDisplayed();
    expect(
      await $('#analyticsPage svg[role="img"] desc').getProperty('textContent')
    ).toContain('4 events');
    await browser.saveScreenshot('/tmp/commandsnippets-analytics-desktop.png');
    await $('#analyticsPage svg[role="img"]').scrollIntoView();
    await browser.saveScreenshot('/tmp/commandsnippets-analytics-charts.png');
    await $('button=Show chart data').click();
    await $('#analyticsPage table').waitForDisplayed();
    await $('button=Hide chart data').click();
    await browser.setViewport({width: 390, height: 844});
    await browser.execute(() => window.scrollTo(0, 0));
    await browser.saveScreenshot('/tmp/commandsnippets-analytics-mobile.png');
    expect(
      await browser.execute(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await $('#analyticsPage svg[role="img"]').scrollIntoView();
    await browser.saveScreenshot(
      '/tmp/commandsnippets-analytics-mobile-charts.png'
    );
    await browser.setViewport({width: 1100, height: 850});
    await browser.execute(() => window.scrollTo(0, 0));
    await $('#view-menu-button').click();
    await $('#view-menu-light-theme').click();
    await $('#analyticsPage svg[role="img"]').scrollIntoView();
    await browser.saveScreenshot(
      '/tmp/commandsnippets-analytics-light-charts.png'
    );
    await $('#analyticsBack').click();
    await $('#tagsEntries-1').waitForDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
