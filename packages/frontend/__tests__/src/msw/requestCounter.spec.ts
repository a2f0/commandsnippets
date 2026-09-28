import {beforeEach, describe, expect, it} from 'vitest';

import {
  getRequestCount,
  recordRequest,
  resetRequestCounts,
} from '../../../src/msw/requestCounter';

describe('requestCounter', () => {
  beforeEach(() => {
    resetRequestCounts();
  });

  it('counts a request under its exact URL and without its query', () => {
    recordRequest('GET', 'http://localhost:9001/api/v1/tags?page=2');
    expect(
      getRequestCount('GET', 'http://localhost:9001/api/v1/tags?page=2')
    ).toBe(1);
    expect(getRequestCount('GET', 'http://localhost:9001/api/v1/tags')).toBe(1);
  });

  it('counts a request without a query once', () => {
    recordRequest('PATCH', 'http://localhost:9001/api/v1/admin/users/7');
    expect(
      getRequestCount('PATCH', 'http://localhost:9001/api/v1/admin/users/7')
    ).toBe(1);
  });
});
