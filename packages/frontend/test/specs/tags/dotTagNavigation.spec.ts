import {BasePage} from '../../pageobjects/base';

it('keeps both dot-only tag names through native history', async () => {
  await BasePage.signIn('test/test-tag-1');
  let previousName = 'test-tag-1';
  let renames = 0;
  // IndexedDB survives within a browser spec: rename the same selected row
  // twice instead of assuming that signing in erases its previous name.
  for (const dot of ['.', '..']) {
    await expect(BasePage.tagLabelWrapper('1')).toHaveText(previousName);
    await BasePage.tag('1').waitAndRightClick();
    await BasePage.tagContextMenuEditTag('1').waitAndLeftClick();
    const name = BasePage.tagEditTagName('1');
    await expect(name).toHaveValue(previousName);
    await name.waitAndLeftClick();
    await browser.keys('End');
    await browser.keys(Array<string>(previousName.length).fill('Backspace'));
    await browser.keys(dot);
    await expect(name).toHaveValue(dot);
    await BasePage.tagEditSave('1').waitAndLeftClick();

    const dotUrl = `http://localhost:8081/test/tags/~${dot}`;
    await expect(browser).toHaveUrl(dotUrl);
    await expect(BasePage.tagLabelWrapper('1')).toHaveText(dot);
    await expect(BasePage.tagsEntries1).toBeDisplayed();
    renames++;
    await browser.toBeRequestedTimes(
      'PATCH',
      'http://localhost:9001/api/v1/tags/1',
      renames
    );

    await BasePage.tagLabelWrapper('2').waitAndLeftClick();
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-2');
    await browser.back();
    await expect(browser).toHaveUrl(dotUrl);
    await expect(BasePage.tagsEntries1).toBeDisplayed();
    await browser.forward();
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-2');
    await BasePage.tagLabelWrapper('1').waitAndLeftClick();
    await expect(browser).toHaveUrl(dotUrl);
    await expect(BasePage.tagsEntries1).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
    previousName = dot;
  }
});
