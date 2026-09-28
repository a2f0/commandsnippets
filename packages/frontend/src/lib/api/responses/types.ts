/**
 * The JSON:API resources as the store keeps them (its models in
 * src/lib/store/models/ have these shapes), derived from the API contract in
 * `@commandsnippets/api-shared`: each is the resource the API sends, less the
 * members the store does not keep. The response documents are api-shared's
 * (`TagListDocument`, `TextEntryDocument`, ...).
 */
import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
  User,
} from '@commandsnippets/api-shared';

/** A tag, all of it. */
export type ITagJsonApi = Tag;

/**
 * An entry, without its `text_entry_to_tag` linkage: the store keeps the
 * junctions themselves (`ITagTextEntryThroughModelJsonApi`).
 */
export interface ITextEntryJsonApi extends Omit<TextEntry, 'relationships'> {
  relationships: Pick<TextEntry['relationships'], 'user'>;
}

/** A tag on an entry, without its owner (the entry's and the tag's). */
export interface ITagTextEntryThroughModelJsonApi
  extends Omit<TagTextEntry, 'relationships'> {
  relationships: Pick<TagTextEntry['relationships'], 'tag' | 'text_entry'>;
}

/** A user, without `is_staff` (the store keeps the signed-in user's apart). */
export interface IUserJsonApi extends Omit<User, 'attributes'> {
  attributes: Pick<User['attributes'], 'username' | 'date_updated'>;
}

/** A resource the store keeps. */
export type StoreResource =
  | ITagJsonApi
  | ITextEntryJsonApi
  | ITagTextEntryThroughModelJsonApi
  | IUserJsonApi;

/**
 * Resources to put in the store: ones it holds, or a response's `data` and
 * `included` (whose entry reuses it does not keep).
 */
export type ResourceCollection = ReadonlyArray<
  StoreResource | IncludedResource
>;
