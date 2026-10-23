import {describe, expect, test} from 'bun:test';
import {trackingOptions} from '../src/lib/clickTracking';

describe('deployed website click collection', () => {
  test.each([
    ['production', 'https://commandsnippets.com'],
    ['staging', 'https://website-staging.commandsnippets.com'],
  ])('%s is isolated to its exact origin', (mode, origin) => {
    const options = trackingOptions(mode ?? '', true, {
      origin: origin ?? '',
      pathname: '/privacy/',
    });
    expect(options).toMatchObject({
      site: 'commandsnippets',
      app: 'website',
      environment: mode,
      capture: 'all',
      overrideGpc: true,
    });
    expect(options?.page?.()).toBe('/privacy/');
  });

  test.each([
    ['production', false, 'https://commandsnippets.com'],
    ['development', true, 'https://commandsnippets.com'],
    ['test', true, 'https://commandsnippets.com'],
    ['staging', true, 'https://commandsnippets.com'],
    ['production', true, 'https://website-staging.commandsnippets.com'],
    ['production', true, 'https://commandsnippets.com:8443'],
    ['production', true, 'http://commandsnippets.com'],
    ['production', true, 'https://preview.workers.dev'],
    ['production', true, 'http://localhost:4321'],
  ] as const)('rejects %s/%s/%s', (mode, production, origin) => {
    expect(trackingOptions(mode, production, {origin, pathname: '/'})).toBe(
      undefined
    );
  });

  test('unknown routes never leak old username or tag paths', () => {
    const location = {
      origin: 'https://commandsnippets.com',
      pathname: '/private-user/private-tag',
    };
    const options = trackingOptions('production', true, location);
    expect(options?.page?.()).toBe('/');
    location.pathname = '/about/';
    expect(options?.page?.()).toBe('/about/');
  });
});
