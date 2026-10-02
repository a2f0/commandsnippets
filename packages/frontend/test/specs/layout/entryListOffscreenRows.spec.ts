import {$, browser, expect} from '@wdio/globals';

import {generateManyEntries} from '../../mocks/entries/manyEntriesResponse';
import {BasePage} from '../../pageobjects/base';

/**
 * A long entry list in the browser, of rows of different heights: it
 * scrolls straight to any row, its last included, and moving the selection
 * with the arrow keys keeps it in view.
 */
const COUNT = 60;
// Bodies of 1, 4 and 12 lines: rows of different heights.
const lines = [1, 4, 12];
const entries = generateManyEntries(COUNT, i =>
  Array.from(
    {length: lines[i % lines.length] ?? 1},
    (_, line) => `entry ${i} line ${line + 1}`
  ).join('\n')
);

/** Whether the row of entry `id` is wholly within the viewport. */
const inView = (id: string) =>
  browser.execute(entryId => {
    const row = document.getElementById(`tagsEntries-${entryId}`);
    if (row === null) {
      return false;
    }
    const {top, bottom} = row.getBoundingClientRect();
    return top >= 0 && bottom <= window.innerHeight;
  }, id);

describe('A long entry list', () => {
  beforeEach(async () => {
    await BasePage.open('');
    await browser.login();
    const result = await browser.execute(mockData => {
      if (!window.setRuntimeEntriesOverride) {
        return false;
      }
      window.setRuntimeEntriesOverride(mockData);
      return true;
    }, entries);
    if (!result) {
      throw new Error('setRuntimeEntriesOverride not available');
    }
    await BasePage.open('test/test-tag-1');
    await browser.waitUntil(
      async () =>
        (await browser.execute(
          () => document.querySelectorAll('[id^="tagsEntries-"]').length
        )) === COUNT,
      {timeout: 15000, timeoutMsg: `Expected all ${COUNT} entries listed`}
    );
  });

  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('scrolls straight to its last row, whatever the heights above it', async () => {
    expect(await inView(String(COUNT))).toBe(false);

    await browser.execute(entryId => {
      document
        .getElementById(`tagsEntries-${entryId}`)
        ?.scrollIntoView({block: 'end'});
    }, String(COUNT));
    await browser.waitUntil(() => inView(String(COUNT)), {
      timeoutMsg: 'Expected the last entry scrolled into view',
    });
    // Rows of different heights, laid out once in view.
    const heights = await browser.execute(() =>
      ['tagsEntries-58', 'tagsEntries-59', 'tagsEntries-60'].map(
        id => document.getElementById(id)?.getBoundingClientRect().height ?? 0
      )
    );
    expect(new Set(heights).size).toBe(3);
  });

  it('keeps the entry the arrow keys select in view', async () => {
    // Selecting the first entry puts the keys to the list.
    await $('#entryBodyOuterDiv1').click();
    const steps = 45;
    for (let step = 0; step < steps; step += 1) {
      await browser.keys('ArrowDown');
    }
    const selected = String(steps + 1);
    await browser.waitUntil(() => inView(selected), {
      timeoutMsg: `Expected entry ${selected}, selected, scrolled into view`,
    });
  });
});
