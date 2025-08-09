import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  afterEach(async () => {
    // Reset MSW handlers after each test
    await browser.resetMSWHandlers();
  });

  it('allows deleting a tag', async () => {
    // Navigate and verify MSW is ready
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();

    // Verify MSW is providing expected data
    const apiCheck = await browser.execute(async () => {
      try {
        const [tagsResponse, entriesResponse] = await Promise.all([
          fetch('http://localhost:9001/api/v1/tags'),
          fetch('http://localhost:9001/api/v1/entries'),
        ]);
        const [tagsData, entriesData] = await Promise.all([
          tagsResponse.json(),
          entriesResponse.json(),
        ]);
        return {
          tagsOk: tagsResponse.ok,
          tagsCount: tagsData.data?.length || 0,
          entriesOk: entriesResponse.ok,
          entriesCount: entriesData.data?.length || 0,
        };
      } catch (error) {
        return {ok: false, error: (error as Error).message};
      }
    });

    console.log('MSW API check:', apiCheck);
    expect(apiCheck.tagsOk).toBe(true);
    expect(apiCheck.entriesOk).toBe(true);
    expect(apiCheck.tagsCount).toBe(4); // MSW provides 4 tags
    await browser.login();
    await BasePage.open('');
    await expect(BasePage.tagList).toBeExisting();
    await expect(BasePage.tagList).toBeDisplayed();
    await expect(BasePage.tagContextMenu1).toBeExisting();
    await expect(BasePage.tag1).toBeExisting();
    await expect(BasePage.tag1).toBeDisplayed();
    await expect(BasePage.tag2).toBeExisting();
    await expect(BasePage.tag2).toBeDisplayed();
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();

    // Test cancel delete
    await (await BasePage.tag1).waitAndRightClick();
    await expect(BasePage.tagContextMenu1).toBeDisplayed();
    await expect(BasePage.tagContextMenu1DeleteTagMenuItem).toBeDisplayed();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).not.toBeDisplayed();
    await (await BasePage.tagContextMenu1DeleteTagMenuItem).waitAndLeftClick();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).toBeDisplayed();
    await expect(
      BasePage.tagContextMenu1DeleteTagDialogDeleteButton
    ).toBeDisplayed();
    await expect(
      BasePage.tagContextMenu1DeleteTagDialogCancelButton
    ).toBeDisplayed();
    await (
      await BasePage.tagContextMenu1DeleteTagDialogCancelButton
    ).waitAndLeftClick();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).not.toBeExisting();

    // Test confirm delete
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await (await BasePage.tag1).waitAndRightClick();
    await expect(BasePage.tagContextMenu1).toBeDisplayed();
    await expect(BasePage.tagContextMenu1DeleteTagMenuItem).toBeDisplayed();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).not.toBeDisplayed();
    await (await BasePage.tagContextMenu1DeleteTagMenuItem).waitAndLeftClick();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).toBeDisplayed();
    await expect(
      BasePage.tagContextMenu1DeleteTagDialogDeleteButton
    ).toBeDisplayed();
    await expect(
      BasePage.tagContextMenu1DeleteTagDialogCancelButton
    ).toBeDisplayed();
    // Click delete button - MSW will intercept the DELETE request
    await (
      await BasePage.tagContextMenu1DeleteTagDialogDeleteButton
    ).waitAndLeftClick();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).not.toBeDisplayed();

    // Verify the delete dialog has closed (main test objective)
    // The UI behavior after deletion depends on the frontend implementation
    // For now, we focus on testing that the delete interaction works properly

    // Test that the context menu is hidden after deletion
    await expect(BasePage.tagContextMenu1).not.toBeDisplayed();

    // Wait for the deletion to be processed
    await browser.pause(500);

    // Verify the tag count has decreased
    await expect(BasePage.tags).toBeElementsArrayOfSize(3);

    // Verify that tag1 no longer exists or has been replaced
    const tag1Exists = await BasePage.tag1.isExisting();
    if (tag1Exists) {
      // If tag1 still exists, it should now contain different content (tag2 moved up)
      await expect(BasePage.tag1).not.toHaveText('Test Tag 1');
    }

    // Test core functionality: delete dialog workflow completed successfully
    console.log(
      '✅ Delete tag workflow completed: dialog opened, delete confirmed, dialog closed, tag removed'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
