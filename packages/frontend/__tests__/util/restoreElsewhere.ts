/**
 * Another device's restore, against the mock API (src/msw/handlers.ts):
 * over the data version active (the one it holds), as the app's restore is.
 */
import {
  type Backup,
  backupSchema,
  DATA_VERSION_HEADER,
  restoreResultSchema,
  userDocumentSchema,
} from '@commandsnippets/api-shared';
import {expect} from 'vitest';

const API = 'http://localhost:9001/api/v1';

/**
 * Restore `backup` (by default the user's own) on another device: a new
 * data version, made active. Returns its number.
 */
export async function restoreElsewhere(backup?: Backup): Promise<number> {
  const user = userDocumentSchema.parse(
    await (await fetch(`${API}/user/`)).json()
  );
  const body =
    backup ??
    backupSchema.parse(await (await fetch(`${API}/user/backup`)).json());
  const response = await fetch(`${API}/user/restore`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [DATA_VERSION_HEADER]: String(user.data.attributes.data_version),
    },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return restoreResultSchema.parse(await response.json()).data_version;
}
