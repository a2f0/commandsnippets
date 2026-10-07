/** `User`: the requesting user (`GET /api/v1/user`), and included owners. */
import * as z from 'zod/mini';
import {resourceSchema, timestampSchema} from '../jsonapi/response';
import {USER} from './types';

export const userAttributesSchema = z.object({
  username: z.string(),
  /** Whether to offer the admin page (the admin API checks it again). */
  is_staff: z.boolean(),
  date_updated: timestampSchema,
  /**
   * When the user's data was last restored from a backup, or null: the API
   * refuses their client writes made before it (`data_restored`), so a
   * client makes its writes after it once it knows. Missing from an API
   * that predates restores.
   */
  date_restored: z.optional(z.nullable(timestampSchema)),
});

export const userSchema = resourceSchema(USER, userAttributesSchema);

export type UserAttributes = z.output<typeof userAttributesSchema>;
export type User = z.output<typeof userSchema>;
