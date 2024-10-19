import entriesResponse from '../../../mocks/entries/entriesResponse';
import tagsDeleteResponse from '../../../mocks/tags/tagsDeleteResponse';
import tagsResponse from '../../../mocks/tags/tagsResponse';
import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  it('allows deleting a tag', async () => {
    const mockEntries = await browser.mock(
      'http://localhost:9001/api/v1/entries?page[number]=1*',
      {method: 'GET'}
    );
    mockEntries.respond(entriesResponse, {statusCode: 200});

    const mockTags = await browser.mock(
      'http://localhost:9001/api/v1/tags?page[number]=1*',
      {
        method: 'GET',
      }
    );
    mockTags.respond(tagsResponse, {statusCode: 200});

    const mockTagDelete = await browser.mock(
      'http://localhost:9001/api/v1/tags/1',
      {
        method: 'DELETE',
      }
    );
    mockTagDelete.respond(tagsDeleteResponse, {statusCode: 204});
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
    expect(mockTagDelete).toBeRequestedTimes(0);
    await (
      await BasePage.tagContextMenu1DeleteTagDialogDeleteButton
    ).waitAndLeftClick();
    await expect(BasePage.tagContextMenu1DeleteTagDialog).not.toBeDisplayed();
    expect(mockTagDelete).toBeRequestedTimes(1);
    await expect(BasePage.tags).toBeElementsArrayOfSize(3);
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
