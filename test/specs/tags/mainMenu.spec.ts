import {BasePage} from '../../pageobjects/base';

describe('Tag Main Menu', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should have a working menu bar', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    // Verify MSW is providing the expected tag data
    const apiCheck = await BasePage.checkTags();

    console.log('API check result:', apiCheck);
    expect(apiCheck.ok).toBe(true);
    expect(apiCheck.dataLength).toBe(4); // MSW provides 4 tags

    // Reset before authenticated navigation to assert counts for that load
    await browser.resetMSWRequestCounts();

    await browser.login();
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();

    await expect(BasePage.tagsMenu).toBeExisting();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();

    // Verify tag count and that first tag is selected
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);

    let tags = await BasePage.tags;

    // Verify the first tag is selected (has dark background color)
    await expect(
      (await $('div[data-testid="tag-1"]').getCSSProperty('background-color'))
        .value
    ).toBe('rgba(72,72,72,1)');

    // Verify URL routing is working
    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify initial state - default order by 'order' field (tag-1 should be first)
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0]?.getAttribute('id');
        return firstId === 'tag-1';
      },
      {
        timeout: 5000,
        timeoutMsg: 'expected tag-1 to be first in default order',
      }
    );

    // Test tags menu button functionality
    await expect(BasePage.tagsMenuButton).toBeExisting();
    await expect(BasePage.tagsMenuButton).toBeDisplayed();
    await expect(BasePage.tagsMenuButton).toBeClickable();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // Click menu button to open menu
    await BasePage.tagsMenuButton.click({button: 'left'});
    await expect(BasePage.tagsMenu).toBeDisplayed();

    // Click sort by date created ascending
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeExisting();
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeDisplayed();
    await expect(BasePage.tagsMenuSortDateCreatedAscending).toBeClickable();
    await BasePage.tagsMenuSortDateCreatedAscending.click({button: 'left'});
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // Verify ascending date order: tag-1 (2020), tag-2 (2021), tag-3 (2022), tag-4 (2022)
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0]?.getAttribute('id');
        const secondId = await tags[1]?.getAttribute('id');
        return firstId === 'tag-1' && secondId === 'tag-2';
      },
      {
        timeout: 5000,
        timeoutMsg:
          'expected tag-1 (oldest) first and tag-2 second in ascending date order',
      }
    );

    // Test descending date sorting
    await expect(BasePage.tagsMenuButton).toBeClickable();
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // Open tags menu again
    await BasePage.tagsMenuButton.click({button: 'left'});
    await expect(BasePage.tagsMenu).toBeDisplayed();

    // Click sort by date created descending
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeExisting();
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeDisplayed();
    await expect(BasePage.tagsMenuSortDateCreatedDescending).toBeClickable();
    await BasePage.tagsMenuSortDateCreatedDescending.click({button: 'left'});
    await expect(BasePage.tagsMenu).not.toBeDisplayed();

    // Verify descending date order: tag-4 (2022-05-08), tag-3 (2022-05-07), tag-2 (2021), tag-1 (2020)
    await browser.waitUntil(
      async () => {
        tags = await BasePage.tags;
        const firstId = await tags[0]?.getAttribute('id');
        const secondId = await tags[1]?.getAttribute('id');
        return firstId === 'tag-4' && secondId === 'tag-3';
      },
      {
        timeout: 5000,
        timeoutMsg:
          'expected tag-4 (newest) first and tag-3 second in descending date order',
      }
    );

    // Verify tag-1 is still selected (highlighted) even after sorting
    await expect(
      (await $('div[data-testid="tag-1"]').getCSSProperty('background-color'))
        .value
    ).toBe('rgba(72,72,72,1)');

    // Verify URL is still pointing to selected tag
    expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
