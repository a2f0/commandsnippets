/** Identity and cache generation of a user-scoped read. Never an admin profile. */
import * as z from 'zod/mini';
import {countSchema, documentSchema, resourceSchema} from '../jsonapi/response';

export const dataOwnerDocumentSchema = documentSchema(
  resourceSchema(
    'DataOwner',
    z.object({
      username: z.string(),
      access: z.enum(['full', 'public']),
      public_revision: countSchema,
    })
  ),
  z.never()
);
export type DataOwnerDocument = z.output<typeof dataOwnerDocumentSchema>;
