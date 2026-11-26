/** `TextEntry`: `/api/v1/entries`. Its requests are in `requests/textEntry.ts`. */
import * as z from 'zod/mini';
import {
  countSchema,
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TEXT_ENTRY} from './types';

/**
 * What an entry is: a `snippet` (text to copy, such as a command) or a
 * `shortcut` (keys to press: its body is a sequence of key combinations,
 * which clients draw as keys).
 */
export const ENTRY_KINDS = ['snippet', 'shortcut'] as const;

export const entryKindSchema = z.enum(ENTRY_KINDS);

export const textEntryAttributesSchema = z.object({
  body: z.string(),
  subject: z.string(),
  kind: entryKindSchema,
  date_updated: timestampSchema,
  date_created: timestampSchema,
  /** Times the entry was reused (`/entry_reuses`); 0 in public reads. */
  reused_count: countSchema,
  is_deleted: z.boolean(),
  is_public: z.boolean(),
  tag_count: countSchema,
  /** The id the client that made the entry gave it (`client_id`), if any. */
  client_id: z.optional(z.nullable(z.string())),
});

export const textEntrySchema = relatedResourceSchema(
  TEXT_ENTRY,
  textEntryAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TEXT_ENTRY])
);

export type EntryKind = z.output<typeof entryKindSchema>;
export type TextEntryAttributes = z.output<typeof textEntryAttributesSchema>;
export type TextEntry = z.output<typeof textEntrySchema>;
