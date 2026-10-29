import {BasePage} from '../../pageobjects/base';

describe('TagsEntries Behavior', () => {
  it('should list tags_entries', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await BasePage.checkTagsAndEntries();

    console.log('MSW API check:', apiCheck);
    expect(apiCheck.tagsOk).toBe(true);
    expect(apiCheck.entriesOk).toBe(true);
    expect(apiCheck.tagsCount).toBe(4); // MSW provides 4 tags
    expect(apiCheck.entriesCount).toBe(3); // MSW provides 3 entries
    // Reset counters right before navigating to authenticated view to assert counts for that load
    await browser.resetMSWRequestCounts();
    await browser.login();
    await expect(BasePage.signInPage).toBeDisplayed();
    await BasePage.open('test/test-tag-1');

    // Verify entries list and search elements exist
    await expect(BasePage.tagsEntriesList).toBeExisting();
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.entrySearch).toBeExisting();
    await expect(BasePage.entrySearch).toBeDisplayed();

    // Wait for the page to fully load

    // test-tag-1 lists entries 1 and 2; the search keeps entry 1 only
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(2);
    // Test entry search functionality by directly interacting with search field
    // Skip complex Tab navigation testing in headless mode - focus on core functionality
    await BasePage.entrySearch.click();
    await browser.keys('entry-1');
    await expect(BasePage.entrySearch).toHaveValue('entry-1');
    await expect(BasePage.tagsEntries).toBeElementsArrayOfSize(1);
    await expect(BasePage.tagsEntries1).toBeDisplayed();

    // Test Escape key clears search
    await browser.keys('Escape');

    // Verify entry search field is cleared
    await expect(BasePage.entrySearch).toHaveValue('');

    // Test core functionality: entry search workflow completed successfully
    console.log(
      'OK: Entry search workflow completed: search field interaction, filtering, and Escape clear'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
