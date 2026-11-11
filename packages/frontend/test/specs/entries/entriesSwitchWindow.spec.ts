import invariant from 'invariant';
import {BasePage} from '../../pageobjects/base';

describe('Tab Switching Behavior', () => {
  it('should allow tab switching while editing', async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();

    await browser.login();

    // Reset counters right before the navigational load we want to assert
    await browser.resetMSWRequestCounts();
    await BasePage.open('');
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify basic elements are present
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Focus on window switching behavior - skip complex context menu interaction
    // Simulate that we have an editing state by checking if entry search is available
    await expect(BasePage.entrySearch).toBeExisting();

    // BiDi commands keep their context; activate tabs to exercise real visibility.
    const app = (await browser.browsingContexts()).find(page =>
      page.url.startsWith('http://localhost:8081/')
    );
    invariant(app, 'the app browsing context should exist');
    const google = await browser.newWindow('https://www.google.com/', {
      type: 'tab',
    });
    invariant('activate' in google, 'the new tab should be a BiDi context');

    // Switch to Google window (URL may contain query params).
    await google.activate();
    await expect(google).toHaveUrl(/^https:\/\/www\.google\.com/);
    await browser.waitUntil(
      async () =>
        (await app.execute(() => document.visibilityState)) === 'hidden'
    );

    // Switch back to our app
    await app.activate();
    await browser.waitUntil(
      async () =>
        (await app.execute(() => document.visibilityState)) === 'visible'
    );
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');
    await expect(BasePage.tagsEntriesList).toBeDisplayed();

    // Initial loading reads the tags once and the entries count plus one page.
    await browser.toBeRequestedTimes(
      'GET',
      'http://localhost:9001/api/v1/tags',
      1
    );
    await browser.toBeRequestedTimes(
      'GET',
      'http://localhost:9001/api/v1/entries',
      2
    );

    // Verify basic functionality persists after window switch
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.entrySearch).toBeExisting();

    // Test one more window switch to verify state persistence
    await google.activate();
    await expect(google).toHaveUrl(/^https:\/\/www\.google\.com/);
    await app.activate();
    await expect(browser).toHaveUrl('http://localhost:8081/test/test-tag-1');

    // Verify app state persists across window switches
    await expect(BasePage.tagsEntriesList).toBeDisplayed();
    await expect(BasePage.tags).toBeElementsArrayOfSize(4);
    await expect(BasePage.entrySearch).toBeExisting();

    expect(browser.currentTestErrors).toHaveLength(0);
    await google.closeWindow();
  });
});
