import {API_VERSION_HEADER} from '@commandsnippets/api-shared';
import {describe, expect, it} from 'vitest';
import packageJson from '../../package.json';
import {ApiClient} from '../helpers';

function preflight(origin: string) {
  return new ApiClient().options('/api/v1/entries', {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type',
  });
}

// Django ran these two classes under the production and staging settings
// modules; v2 has a single CORS allowlist, so both run against the same app.
const suites = [
  // Django origin: backend/tearleads/core/tests/test_cors_preflight.py
  'TestCORSPreflightProduction',
  // Django origin: backend/tearleads/core/tests/test_cors_preflight.py
  'TestCORSPreflightStaging',
];

for (const suite of suites) {
  describe(suite, () => {
    it('test_preflight_allows_production_domain', async () => {
      const response = await preflight('https://commandsnippets.com');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://commandsnippets.com'
      );
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe(
        'true'
      );
    });

    it('test_preflight_allows_production_subdomain', async () => {
      const response = await preflight('https://app.commandsnippets.com');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'https://app.commandsnippets.com'
      );
    });

    it('test_preflight_allows_staging_subdomain', async () => {
      for (const origin of [
        'https://app-staging.commandsnippets.com',
        'https://website-staging.commandsnippets.com',
      ]) {
        const response = await preflight(origin);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
          origin
        );
      }
    });

    it('test_preflight_denies_unauthorized_origin', async () => {
      const response = await preflight('https://evil.com');
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    });

    if (suite === 'TestCORSPreflightProduction') {
      it('test_preflight_denies_legacy_domain', async () => {
        const response = await preflight('https://tearleads.com');
        expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
      });
    }
  });
}

// v2: the Django regexes were only anchored at the start; v2 anchors both
// ends, so these lookalikes are refused while real dev origins still work.
describe('CORSAllowlist', () => {
  for (const origin of [
    'http://localhost',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://10.0.0.12:8085',
    'http://172.16.4.2:8085',
    'http://192.168.1.10:8085',
  ]) {
    it(`allows ${origin}`, async () => {
      const response = await preflight(origin);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
        'PATCH'
      );
    });
  }

  for (const origin of [
    'http://localhost.evil.com',
    'http://localhost:8080.evil.com',
    'http://10.0.0.1.evil.com',
    'http://172.32.0.1:8085',
    'https://localhost:8080',
    'https://commandsnippets.com.evil.com',
    'https://evil.commandsnippets.com.evil.com',
    'https://a.b.commandsnippets.com',
    // Staging moved to hyphenated first-level names.
    'https://app.staging.commandsnippets.com',
    'https://app-staging.commandsnippets.com.evil.com',
    'https://-app.commandsnippets.com',
    'https://app_staging.commandsnippets.com',
    // The retired Electron and Capacitor apps' origins.
    'tearleads://app',
    'tearleads-dev://app',
    'capacitor://localhost',
  ]) {
    it(`denies ${origin}`, async () => {
      const response = await preflight(origin);
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    });
  }

  it('sets CORS headers on simple (non-preflight) responses too', async () => {
    const response = await new ApiClient().get('/healthcheck/', {
      Origin: 'https://commandsnippets.com',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://commandsnippets.com'
    );
  });

  // v2: the web app is on another origin, and a browser hides every response
  // header from it that CORS does not expose.
  it('exposes the API version to the web app', async () => {
    const response = await new ApiClient().get('/api/v1/user/', {
      Origin: 'https://app.commandsnippets.com',
    });
    expect(response.headers.get(API_VERSION_HEADER)).toBe(packageJson.version);
    expect(
      response.headers
        .get('Access-Control-Expose-Headers')
        ?.split(',')
        .map(name => name.trim().toLowerCase())
    ).toContain(API_VERSION_HEADER.toLowerCase());
  });
});
