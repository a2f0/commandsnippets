/**
 * `POST .../reorder` (tags, and tag-entry junctions): move `top` directly
 * above `bottom` (django-ordered-model's `top.above(bottom)`). Both are pks
 * of the endpoint's resource type; the server checks that they exist.
 */
import * as z from 'zod/mini';
import {pkField} from '../../fields';

export const reorderAttributesSchema = z.object({
  top: pkField(),
  bottom: pkField(),
});

export type ReorderAttributes = z.output<typeof reorderAttributesSchema>;
