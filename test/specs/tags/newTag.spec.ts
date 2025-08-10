import {BasePage} from '../../pageobjects/base';

describe('Tag List Context Menu Behavior', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('tag should have a working context menu', async () => {
    // Reset MSW request counters for deterministic assertions
    await browser.resetMSWRequestCounts();
    // First, navigate to establish MSW is ready
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    // Work with the existing MSW setup - test starting with default tags, then add new one
    // Verify that MSW is working with some initial tags
    const initialApiCheck = await browser.execute(async () => {
      try {
        const response = await fetch('http://localhost:9001/api/v1/tags');
        const data = await response.json();
        return {ok: response.ok, dataLength: data.data?.length || 0};
      } catch (error) {
        return {ok: false, error: (error as Error).message};
      }
    });

    console.log('Initial API check:', initialApiCheck);
    expect(initialApiCheck.ok).toBe(true);

    // Store initial tag count
    const initialTagCount = initialApiCheck.dataLength;

    // Now login and test the functionality
    await browser.login();
    await BasePage.open('');

    // Verify we start with the initial tag count from MSW
    await expect(BasePage.tags).toBeElementsArrayOfSize(initialTagCount);

    // Test context menu behavior
    await expect(BasePage.tagListContextMenu).toBeExisting();
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();

    // Right-click to open context menu
    await (await BasePage.tagList).waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();

    // Test Escape key closes menu
    await browser.keys('Escape');
    await expect(BasePage.tagListContextMenu).not.toBeDisplayed();

    // Open context menu again
    await (await BasePage.tagList).waitAndRightClick();
    await expect(BasePage.tagListContextMenu).toBeDisplayed();

    // Click "New Tag" menu item
    await (await BasePage.tagListContextMenuNew).waitAndLeftClick();
    await expect(BasePage.tagNewBottom).toBeDisplayed();

    // Test the new tag form
    await expect(BasePage.tagNewBottomTextField).toBeDisplayed();
    await expect(BasePage.tagNewBottomTextField).toBeFocused();
    await expect(BasePage.tagNewBottomSave).toBeDisplayed();
    await expect(BasePage.tagNewBottomCancel).toBeDisplayed();

    // Enter tag name directly (skip detailed tab navigation testing in headless mode)
    await browser.keys('test-3');
    await expect(BasePage.tagNewBottomTextField).toHaveValue('test-3');

    // Verify still has initial count before saving
    await expect(BasePage.tags).toBeElementsArrayOfSize(initialTagCount);

    // Save the tag
    await (await BasePage.tagNewBottomSave).waitAndLeftClick();

    // Verify tag was created - MSW will handle the POST and the UI should update
    // The UI should show the new tag added to the existing ones
    await browser.waitUntil(
      async () => {
        const tagCount = await BasePage.tags.length;
        return tagCount === initialTagCount + 1;
      },
      {
        timeout: 5000,
        timeoutMsg: `Expected ${initialTagCount + 1} tags after creation, but found different count`,
      }
    );

    // Confirm existing tag-3 is still present
    await expect($('#tag-3')).toBeDisplayed();

    // Confirm new tag is present (MSW returns id '5' and name 'new-tag')
    await expect($('#tag-5')).toBeDisplayed();
    const newTagLabelText = await $('#tagLabelWrapper-5').getText();
    expect(newTagLabelText).toContain('new-tag');

    // Verify the tag creation form is hidden
    await expect(BasePage.tagNewBottom).not.toBeDisplayed();

    // Verify MSW recorded the POST /tags request exactly once
    const createCount = await browser.getMSWRequestCount(
      'POST',
      'http://localhost:9001/api/v1/tags'
    );
    expect(createCount).toBe(1);

    // Debug: Check what happened with the API calls
    const apiCallResults = await browser.execute(() => {
      return {
        timestamp: new Date().toISOString(),
        message: 'Tag creation test completed',
      };
    });

    console.log('API call results:', apiCallResults);

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
