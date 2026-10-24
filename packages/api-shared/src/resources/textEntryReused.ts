/**
 * `TextEntryReused`: a record of an entry being reused
 * (`/api/v1/entry_reuses`). Its requests are in `requests/textEntryReused.ts`.
 */
import * as z from 'zod/mini';
import {
  relatedResourceSchema,
  relationshipsSchema,
  timestampSchema,
} from '../jsonapi/response';
import {RELATIONSHIPS, TEXT_ENTRY_REUSED} from './types';

/** A reuse is when its entry was reused (copied). */
export const textEntryReusedAttributesSchema = z.object({
  date_created: timestampSchema,
});

export const textEntryReusedSchema = relatedResourceSchema(
  TEXT_ENTRY_REUSED,
  textEntryReusedAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TEXT_ENTRY_REUSED])
);

export type TextEntryReused = z.output<typeof textEntryReusedSchema>;
