/** `TextEntry`: `/api/v1/entries`. Its requests are in `requests/textEntry.ts`. */
import * as z from 'zod/mini';
import {
  countSchema,
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TEXT_ENTRY} from './types';

export const textEntryAttributesSchema = z.object({
  body: z.string(),
  subject: z.string(),
  date_updated: timestampSchema,
  date_created: timestampSchema,
  reused_count: countSchema,
  is_deleted: z.boolean(),
  tag_count: countSchema,
  /** The id the client that made the entry gave it (`client_id`), if any. */
  client_id: z.optional(z.nullable(z.string())),
});

export const textEntrySchema = relatedResourceSchema(
  TEXT_ENTRY,
  textEntryAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TEXT_ENTRY])
);

export type TextEntryAttributes = z.output<typeof textEntryAttributesSchema>;
export type TextEntry = z.output<typeof textEntrySchema>;
