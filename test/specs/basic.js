const assert = require('assert');

describe('index page', () => {
  it('loads correctly', () => {
    browser.url('http://localhost:8080');
    const title = browser.getTitle();
    assert.strictEqual(title, 'Tearleads');      
  });
});