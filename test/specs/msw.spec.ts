import {BasePage} from '../pageobjects/base';

describe('MSW Example Tests', () => {
  beforeEach(async () => {
    // Start MSW worker before each test
    await browser.msw.startWorker();
  });

  afterEach(async () => {
    // Reset handlers after each test
    await browser.msw.resetHandlers();
  });

  it('should load with default MSW handlers', async () => {
    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });

  it('should handle custom API responses', async () => {
    // Mock a custom response for a specific endpoint
    await browser.msw.mockApiResponse(
      'GET',
      'http://localhost:9001/api/v1/tags',
      {
        data: [
          {
            type: 'Tag',
            id: 'custom-tag',
            attributes: {
              name: 'Custom Test Tag',
              order: 1,
              date_updated: '2024-01-01T00:00:00.000Z',
              date_created: '2024-01-01T00:00:00.000Z',
            },
            relationships: {
              user: {
                data: {
                  type: 'User',
                  id: '1',
                },
              },
            },
          },
        ],
        included: [],
      }
    );

    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });

  it('should handle network errors', async () => {
    // Mock a network error for a specific endpoint
    await browser.msw.mockNetworkError('http://localhost:9001/api/v1/tags');

    await BasePage.open('');
    // The page should still load even with network errors
    await expect(BasePage.tagLine).toBeDisplayed();
  });

  it('should handle different HTTP status codes', async () => {
    // Mock a 404 response
    await browser.msw.mockApiResponse(
      'GET',
      'http://localhost:9001/api/v1/nonexistent',
      {error: 'Not found'},
      404
    );

    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });

  it('should add custom handlers dynamically', async () => {
    // Add a custom handler for a specific endpoint
    await browser.msw.addHandler(
      'POST',
      'http://localhost:9001/api/v1/custom',
      {success: true, message: 'Custom handler response'}
    );

    await BasePage.open('');
    await expect(BasePage.tagLine).toBeDisplayed();
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
