/** Request documents and headers the specs send the mock API themselves. */
import {
  JSON_API_MEDIA_TYPE,
  type TagTextEntryCreateDocument,
} from '@commandsnippets/api-shared';

/** The headers of a request whose body is a JSON:API document. */
export const JSON_API = {'Content-Type': JSON_API_MEDIA_TYPE};

/** A `POST /tags_entries` document: tag `entryId` with `tagId`. */
export const tagEntryDocument = (
  tagId: string,
  entryId: string
): TagTextEntryCreateDocument => ({
  data: {
    type: 'TagTextEntryThroughModel',
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
    },
  },
});

/**
 * A `POST /tags/reorder` or `/tags_entries/reorder` document: `top` moves
 * directly above `bottom`.
 */
export const reorderDocument = (
  type: 'Tag' | 'TagTextEntryThroughModel',
  top: string,
  bottom: string
) => ({data: {type, attributes: {top, bottom}}});
