import {$, browser, expect} from '@wdio/globals';

import {generateManyEntries} from '../../mocks/entries/manyEntriesResponse';
import {BasePage} from '../../pageobjects/base';

/**
 * A list long enough to render only the rows in view (`VIRTUALIZE_FROM`),
 * in the browser: rows of different heights, measured as they render. It
 * scrolls to its last row, and moving the selection with the arrow keys
 * keeps it in view, rendering rows as they come into view. A row with its
 * editor open stays rendered, out of view too, so its text is kept.
 */
const COUNT = 300;
// Bodies of 1, 4 and 12 lines: rows of different heights.
const lines = [1, 4, 12];
const entries = generateManyEntries(COUNT, i =>
  Array.from(
    {length: lines[i % lines.length] ?? 1},
    (_, line) => `entry ${i} line ${line + 1}`
  ).join('\n')
);

const rendered = () =>
  browser.execute(
    () => document.querySelectorAll('[id^="tagsEntries-"]').length
  );

/** Whether the row of entry `id` is rendered, wholly within the viewport. */
const inView = (id: string) =>
  browser.execute(entryId => {
    const row = document.getElementById(`tagsEntries-${entryId}`);
    if (row === null) {
      return false;
    }
    const {top, bottom} = row.getBoundingClientRect();
    return top >= 0 && bottom <= window.innerHeight;
  }, id);

describe('A long, virtualized entry list', () => {
  beforeEach(async () => {
    await BasePage.open('');
    await browser.login();
    // As one JSON string: WebDriver serializes an object argument node by
    // node, which takes tens of seconds for this many entries.
    const result = await browser.execute(json => {
      if (!window.setRuntimeEntriesOverride) {
        return false;
      }
      window.setRuntimeEntriesOverride(JSON.parse(json));
      return true;
    }, JSON.stringify(entries));
    if (!result) {
      throw new Error('setRuntimeEntriesOverride not available');
    }
    await BasePage.open('test/test-tag-1');
    await browser.waitUntil(async () => (await rendered()) > 0, {
      timeout: 15000,
      timeoutMsg: 'Expected the entries listed',
    });
  });

  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('renders only the rows in view, and scrolls to its last row', async () => {
    expect(await rendered()).toBeLessThan(COUNT / 3);
    expect(await inView(String(COUNT))).toBe(false);

    // To the end of the page (which grows as rows are measured).
    await browser.waitUntil(
      async () => {
        await browser.execute(() =>
          window.scrollTo(0, document.documentElement.scrollHeight)
        );
        return inView(String(COUNT));
      },
      {timeoutMsg: 'Expected the last entry scrolled into view'}
    );
    expect(await rendered()).toBeLessThan(COUNT / 3);
  });

  it('keeps the entry the arrow keys select in view', async () => {
    // Selecting the first entry puts the keys to the list.
    await $('#entryBodyOuterDiv1').click();
    const steps = 60;
    for (let step = 0; step < steps; step += 1) {
      await browser.keys('ArrowDown');
    }
    const selected = String(steps + 1);
    await browser.waitUntil(() => inView(selected), {
      timeoutMsg: `Expected entry ${selected}, selected, scrolled into view`,
    });
  });

  it('keeps an editor open, its text and all, while the window scrolls away and back', async () => {
    await BasePage.tagsEntries1.waitAndRightClick();
    await BasePage.tagsEntriesContextMenu1Edit.waitAndLeftClick();
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();
    await browser.keys('-draft');

    await browser.waitUntil(
      async () => {
        await browser.execute(() =>
          window.scrollTo(0, document.documentElement.scrollHeight)
        );
        return inView(String(COUNT));
      },
      {timeoutMsg: 'Expected the last entry scrolled into view'}
    );
    await browser.execute(() => window.scrollTo(0, 0));

    await expect(BasePage.textEntryEdit1Subject).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Subject).toHaveValue(
      'Holy Grail Test Entry 1-draft'
    );
  });
});
