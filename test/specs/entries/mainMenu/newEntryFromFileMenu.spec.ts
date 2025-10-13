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

    console.log(
      'OK: File menu entry creation test completed: all basic MSW-integrated functionality verified'
    );

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
