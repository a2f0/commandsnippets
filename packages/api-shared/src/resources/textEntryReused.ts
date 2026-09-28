/**
 * `TextEntryReused`: a record of an entry being reused
 * (`/api/v1/entry_reuses`). Its requests are in `requests/textEntryReused.ts`.
 */
import {z} from 'zod';
import {relatedResourceSchema, relationshipsSchema} from '../jsonapi/response';
import {RELATIONSHIPS, TEXT_ENTRY_REUSED} from './types';

/** A reuse has no attributes of its own. */
export const textEntryReusedAttributesSchema = z.object({});

export const textEntryReusedSchema = relatedResourceSchema(
  TEXT_ENTRY_REUSED,
  textEntryReusedAttributesSchema,
  relationshipsSchema(RELATIONSHIPS[TEXT_ENTRY_REUSED])
);

export type TextEntryReused = z.output<typeof textEntryReusedSchema>;
