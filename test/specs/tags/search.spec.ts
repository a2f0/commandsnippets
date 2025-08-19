import {BasePage} from '../../pageobjects/base';

describe('Tag Search Menu Behavior', () => {
  it('should have a functional search bar', async () => {
    // Navigate to page first, then login (relying on application MSW)
    await BasePage.open('');
    await browser.login();
    // Reset before asserting counts for authenticated load
    await browser.resetMSWRequestCounts();
    await BasePage.open('');

    const pageTitle = await browser.getTitle();
    expect(pageTitle).toBe('Tearleads');

    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify MSW is working by checking API directly
    const apiResult = await browser.execute(async () => {
      try {
        const response = await fetch('http://localhost:9001/api/v1/tags');
        const data = await response.json();
        return {ok: response.ok, dataLength: data.data?.length || 0};
      } catch (error) {
        return {ok: false, error: (error as Error).message};
      }
    });

    console.log('API result:', apiResult);

    // MSW should be providing 4 tags
    expect(apiResult.ok).toBe(true);
    expect(apiResult.dataLength).toBe(4);

    // Assert GET /tags was requested at least once for the authenticated load
    await browser.toBeRequestedAtLeastTimes(
      'GET',
      'http://localhost:9001/api/v1/tags',
      1
    );

    // Since MSW is providing 4 tags, the UI should show 4 tags
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toBeExisting();
    await expect(BasePage.tagSearch).toBeDisplayed();
    await expect(BasePage.tagSearch).toBeFocused();

    // Type the second tag name (test-tag-2)
    const searchTagName = 'test-tag-2';
    await browser.keys(searchTagName);

    // Should filter to 1 tag
    await expect(BasePage.tags).toBeElementsArrayOfSize(1);
    await expect(BasePage.tagSearch).toHaveValue(searchTagName);

    // Clear search with Escape key
    await browser.keys('Escape');

    // Should show all 4 tags again
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagSearch).toHaveValue('');

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
