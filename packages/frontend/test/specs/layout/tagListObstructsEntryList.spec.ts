import {expect} from '@wdio/globals';

import {BasePage} from '../../pageobjects/base';

describe('Layout', () => {
  it('should not have the tag list obstruct the entry list', async () => {
    await BasePage.signIn('');

    // Wait for elements to be displayed
    await BasePage.tagList.waitForDisplayed({timeout: 5000});
    await BasePage.tagsEntriesList.waitForDisplayed({timeout: 5000});

    const tagListLocation = await BasePage.tagList.getLocation();
    const tagListSize = await BasePage.tagList.getSize();
    const entryListLocation = await BasePage.tagsEntriesList.getLocation();

    expect(tagListLocation.x + tagListSize.width).toBeLessThanOrEqual(
      entryListLocation.x
    );
  });
});
