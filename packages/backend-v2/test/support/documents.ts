/** Request documents the tests send. */

/**
 * A tagging (`POST /api/v1/tags_entries`) of entry `entry` with tag `tag`,
 * their ids sent as strings (the API reads a linkage's id as one, whatever
 * is sent).
 */
export const taggingDocument = (tag: unknown, entry: unknown) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    relationships: {
      tag: {data: {type: 'Tag', id: String(tag)}},
      text_entry: {data: {type: 'TextEntry', id: String(entry)}},
    },
  },
});

/**
 * A reorder (`POST /api/v1/tags/reorder`, `/tags_entries/reorder`) of
 * `type`'s rows `top` and `bottom`, sent as given: the API checks their
 * types.
 */
export const reorderDocument = (
  type: 'Tag' | 'TagTextEntryThroughModel',
  top: unknown,
  bottom: unknown
) => ({data: {type, attributes: {top, bottom}}});
