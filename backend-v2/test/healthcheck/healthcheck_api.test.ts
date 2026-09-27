import {describe, expect, it} from 'vitest';
import {setUpBase} from '../helpers';

// tearleads/healthcheck/tests/test_healthcheck_api.py
describe('TestHealthCheckApi', () => {
  it('test_health_check', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.get('/healthcheck/');
    expect(response.status).toBe(200);
  });
});
