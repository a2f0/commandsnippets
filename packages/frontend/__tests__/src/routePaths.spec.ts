// @vitest-environment node
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

import {STATIC_ROUTE_PATHS} from '../../src/routePaths';

// Usernames are the first path segment (`/:user/:tag`), so the API must never
// give out one of the app's own route segments as a username.
const reserved: unknown = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        '../../../backend-v2/src/services/reserved-usernames.json',
        import.meta.url
      )
    ),
    'utf8'
  )
);

describe('static routes', () => {
  it.each(STATIC_ROUTE_PATHS)(
    '%s starts with a username the API reserves',
    path => {
      const segment = path.split('/')[1]?.toLowerCase();
      expect(segment).toBeTruthy();
      expect(reserved).toContain(segment);
    }
  );
});
