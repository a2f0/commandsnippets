import {BasePage} from '../../../pageobjects/base';

describe('Tag Context Menu', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it('renames a tag', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await browser.login();
    await BasePage.open('test/test-tag-1');
    await expect(BasePage.tagLabelWrapper('2')).toHaveText('test-tag-2');

    // Edit Tag, from the tag's context menu
    await BasePage.tag('2').waitAndRightClick();
    await expect(BasePage.tagContextMenu('2')).toBeDisplayed();
    await BasePage.tagContextMenuEditTag('2').waitAndLeftClick();
    const name = BasePage.tagEditTagName('2');
    await expect(name).toHaveValue('test-tag-2');

    // Replace the name ('test-tag-2' is 10 characters) and save
    await name.waitAndLeftClick();
    await browser.keys('End');
    await browser.keys(Array<string>(10).fill('Backspace'));
    await browser.keys('renamed-tag');
    await expect(name).toHaveValue('renamed-tag');
    await BasePage.tagEditSave('2').waitAndLeftClick();

    // The list shows the API's answer, and the API keeps the new name
    await expect(BasePage.tagLabelWrapper('2')).toHaveText('renamed-tag');
    await browser.toBeRequestedTimes(
      'PATCH',
      'http://localhost:9001/api/v1/tags/2',
      1
    );
    expect(await BasePage.fetchApi('/tags')).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({
          id: '2',
          attributes: expect.objectContaining({name: 'renamed-tag'}),
        }),
      ]),
    });

    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
