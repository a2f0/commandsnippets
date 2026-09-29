/**
 * The JSON:API resources the app keeps (in IndexedDB, `lib/db/`) and shows,
 * as the API sends them: api-shared's resource types, by the names the
 * components use.
 */
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';

export type ITagJsonApi = Tag;
export type ITextEntryJsonApi = TextEntry;
export type ITagTextEntryThroughModelJsonApi = TagTextEntry;
