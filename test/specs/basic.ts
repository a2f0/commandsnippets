import {BasePage} from '../pageobjects/base';

describe('Page Behavior', () => {
  it('should load', async () => {
    await BasePage.open('');
  });
});
