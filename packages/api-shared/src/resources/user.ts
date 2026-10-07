/** `User`: the requesting user (`GET /api/v1/user`), and included owners. */
import * as z from 'zod/mini';
import {
  resourceSchema,
  timestampSchema,
  versionSchema,
} from '../jsonapi/response';
import {USER} from './types';

export const userAttributesSchema = z.object({
  username: z.string(),
  /** Whether to offer the admin page (the admin API checks it again). */
  is_staff: z.boolean(),
  date_updated: timestampSchema,
  /**
   * The user's active data version (`dataVersion.ts`): what their data
   * reads and writes are of. A client whose copy is of another clears it
   * and syncs again.
   */
  data_version: versionSchema,
});

export const userSchema = resourceSchema(USER, userAttributesSchema);

export type UserAttributes = z.output<typeof userAttributesSchema>;
export type User = z.output<typeof userSchema>;
