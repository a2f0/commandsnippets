import {expect} from '@wdio/globals';

import {BasePage} from '../../pageobjects/base';

describe('Layout', () => {
  it('should not have the tag list obstruct the entry list', async () => {
    await BasePage.open('');
    await browser.execute(() => {
      window.localStorage.setItem('LoggedIn', 'true');
    });
    await BasePage.open('');

    await browser.pause(1000);

    const tagList = await browser.$('#tagList');
    const entryList = await browser.$('#tagsEntriesList');

    const tagListLocation = await tagList.getLocation();
    const tagListSize = await tagList.getSize();
    const entryListLocation = await entryList.getLocation();

    expect(tagListLocation.x + tagListSize.width).toBeLessThanOrEqual(
      entryListLocation.x
    );
  });
});
