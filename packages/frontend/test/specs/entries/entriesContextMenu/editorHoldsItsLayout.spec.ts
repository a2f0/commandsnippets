import {browser, expect} from '@wdio/globals';

import {BasePage} from '../../../pageobjects/base';

/**
 * The entry editor's buttons stay put while the pointer or the focus moves
 * over its fields: hovering or focusing the body never changes its height.
 */

/** The Save button's top, from the editor's top, in CSS pixels. */
const saveOffset = () =>
  browser.execute(() => {
    const editor = document.getElementById('textEntryEdit1');
    const save = document.getElementById('textEntryEdit1Save');
    if (editor === null || save === null) {
      return null;
    }
    return (
      save.getBoundingClientRect().top - editor.getBoundingClientRect().top
    );
  });

describe('The entry editor', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('keeps its buttons in place when the body is hovered or focused', async () => {
    await BasePage.open('');
    await browser.login();
    await expect(BasePage.signInPage).toBeDisplayed();
    await BasePage.open('test/test-tag-1');

    await BasePage.tagsEntries1.waitAndRightClick();
    await BasePage.tagsEntriesContextMenu1Edit.waitAndLeftClick();
    await expect(BasePage.textEntryEdit1Body).toBeDisplayed();
    await expect(BasePage.textEntryEdit1Subject).toBeFocused();

    // At rest: the pointer off the body, the subject focused
    await BasePage.textEntryEdit1Subject.moveTo();
    const atRest = await saveOffset();
    expect(atRest).not.toBeNull();

    await BasePage.textEntryEdit1Body.moveTo();
    expect(await saveOffset()).toBe(atRest);

    await BasePage.textEntryEdit1Body.click();
    await expect(BasePage.textEntryEdit1Body).toBeFocused();
    expect(await saveOffset()).toBe(atRest);

    await BasePage.textEntryEdit1Subject.moveTo();
    expect(await saveOffset()).toBe(atRest);

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
