import {BasePage} from '../../../pageobjects/base';

describe('Entry Main Menu', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('should having a working new entry from the file menu', async () => {
    // Navigate to page first, then login (using MSW)
    await BasePage.open('');
    await browser.login();
    await BasePage.open('');

    // Test basic file menu functionality
    await expect(BasePage.fileMenu).toBeExisting();
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await BasePage.fileMenuButton.waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();

    // Close menu with escape and reopen
    await browser.keys('Escape');
    await expect(BasePage.fileMenu).not.toBeDisplayed();
    await BasePage.fileMenuButton.waitAndLeftClick();
    await expect(BasePage.fileMenu).toBeDisplayed();

    // Test opening new entry form from file menu
    await expect(BasePage.entryNewTop).not.toBeExisting();
    await BasePage.fileMenuNewEntry.waitAndLeftClick();
    await expect(BasePage.entryNewTop).toBeExisting();
    await expect(BasePage.entryNewTop).toBeDisplayed();

    // Test basic form functionality
    await expect(BasePage.entryNewTopSubject).toBeFocused();
    await browser.keys('Test Subject from File Menu');
    expect(BasePage.entryNewTopSubject).toHaveValue(
      'Test Subject from File Menu'
    );

    await BasePage.entryNewTopBody.waitAndLeftClick();
    await expect(BasePage.entryNewTopBody).toBeFocused();
    await browser.keys('Test body content from file menu');
    expect(BasePage.entryNewTopBody).toHaveValue(
      'Test body content from file menu'
    );

    // Save: the API creates the entry (id 4), and the app tags it with the
    // tag shown (test-tag-1), so the tag's list shows it
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    // Clear of the bottom bar, which covers the lower edge of the page
    await BasePage.entryNewTopSave.scrollIntoView({block: 'center'});
    await BasePage.entryNewTopSave.waitAndLeftClick();
    await expect(BasePage.entryNewTop).not.toBeExisting();
    await expect(BasePage.tagsEntry('4')).toHaveText(
      expect.stringContaining('Test Subject from File Menu')
    );
    await browser.toBeRequestedTimes(
      'POST',
      'http://localhost:9001/api/v1/entries',
      1
    );
    await browser.toBeRequestedTimes(
      'POST',
      'http://localhost:9001/api/v1/tags_entries',
      1
    );

    // The API holds the entry, tagged once, and the junction to tag 1
    expect(await BasePage.fetchApi('/entries')).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: '4',
          attributes: expect.objectContaining({
            subject: 'Test Subject from File Menu',
            tag_count: 1,
          }),
        }),
      ]),
      included: expect.arrayContaining([
        expect.objectContaining({
          type: 'TagTextEntryThroughModel',
          relationships: expect.objectContaining({
            tag: {data: {type: 'Tag', id: '1'}},
            text_entry: {data: {type: 'TextEntry', id: '4'}},
          }),
        }),
      ]),
    });

    console.log(
      'OK: File menu entry creation test completed: all basic MSW-integrated functionality verified'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
