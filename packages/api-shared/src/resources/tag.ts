/** `Tag`: `/api/v1/tags`. Its requests are in `requests/tag.ts`. */
import * as z from 'zod/mini';
import {
  countSchema,
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TAG} from './types';

export const tagAttributesSchema = z.object({
  name: z.string(),
  date_created: timestampSchema,
  date_last_used: z.nullable(timestampSchema),
  /**
   * The tag's revision. It advances when the tag changes, and whenever one of
   * its entries changes, joins it or leaves it, so a client can skip syncing
   * a tag's entries while it holds the tag's latest revision.
   */
  date_updated: timestampSchema,
  entry_count: countSchema,
  order: countSchema,
  is_deleted: z.boolean(),
  is_public: z.boolean(),
  /** The id the client that made the tag gave it (`client_id`), if any. */
  client_id: z.optional(z.nullable(z.string())),
});

export const tagSchema = relatedResourceSchema(
  TAG,
  tagAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TAG])
);

export type TagAttributes = z.output<typeof tagAttributesSchema>;
export type Tag = z.output<typeof tagSchema>;
