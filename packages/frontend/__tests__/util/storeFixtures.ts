import type {User} from '@commandsnippets/api-shared/responses';
import type {
  ITagJsonApi,
  ITagTextEntryThroughModelJsonApi,
  ITextEntryJsonApi,
} from '../../src/lib/api/responses/types';
import {syncSession} from '../../src/lib/sync/session';

const date = '2020-01-01T00:00:00';

export const testUser: User = {
  id: '1',
  type: 'User',
  attributes: {username: 'test', is_staff: false, date_updated: date},
};

const owner: ITagJsonApi['relationships'] = {
  user: {data: {id: testUser.id, type: 'User'}},
};

/** A tag of `testUser`'s. */
export function tag(
  id: string,
  attributes: Partial<ITagJsonApi['attributes']>
): ITagJsonApi {
  return {
    id,
    type: 'Tag',
    attributes: {
      name: `tag-${id}`,
      is_public: false,
      entry_count: 0,
      order: Number(id),
      date_updated: date,
      date_created: date,
      date_last_used: date,
      is_deleted: false,
      ...attributes,
    },
    relationships: owner,
  };
}

/** An entry of `testUser`'s. */
export function entry(
  id: string,
  attributes: Partial<ITextEntryJsonApi['attributes']>,
  junctionIds: readonly string[] = []
): ITextEntryJsonApi {
  return {
    id,
    type: 'TextEntry',
    attributes: {
      body: `body-${id}`,
      subject: `subject-${id}`,
      date_updated: date,
      date_created: date,
      is_public: false,
      reused_count: 0,
      is_deleted: false,
      tag_count: junctionIds.length,
      ...attributes,
    },
    relationships: {
      ...owner,
      text_entry_to_tag: {
        data: junctionIds.map(junctionId => ({
          type: 'TagTextEntryThroughModel',
          id: junctionId,
        })),
        meta: {count: junctionIds.length},
      },
    },
  };
}

/** Tags `entryId` with `tagId`. */
export function junction(
  id: string,
  tagId: string,
  entryId: string
): ITagTextEntryThroughModelJsonApi {
  return {
    id,
    type: 'TagTextEntryThroughModel',
    attributes: {
      order: Number(id),
      date_updated: date,
      date_created: date,
      is_deleted: false,
    },
    relationships: {
      tag: {data: {id: tagId, type: 'Tag'}},
      text_entry: {data: {id: entryId, type: 'TextEntry'}},
      ...owner,
    },
  };
}

/**
 * Store `resources` in the signed-in user's IndexedDB database, as `owner`'s
 * (the signed-in user's own by default).
 */
export async function seed(
  resources: ReadonlyArray<
    ITagJsonApi | ITextEntryJsonApi | ITagTextEntryThroughModelJsonApi
  >,
  owner: string = testUser.attributes.username
): Promise<void> {
  const {db} = syncSession(testUser.attributes.username);
  const owned = <R>(rows: R[]) => rows.map(row => ({...row, owner}));
  await db.tags.bulkPut(owned(resources.filter(isTag)));
  await db.entries.bulkPut(owned(resources.filter(isEntry)));
  await db.junctions.bulkPut(owned(resources.filter(isJunction)));
}

type Resource =
  | ITagJsonApi
  | ITextEntryJsonApi
  | ITagTextEntryThroughModelJsonApi;
const isTag = (resource: Resource): resource is ITagJsonApi =>
  resource.type === 'Tag';
const isEntry = (resource: Resource): resource is ITextEntryJsonApi =>
  resource.type === 'TextEntry';
const isJunction = (
  resource: Resource
): resource is ITagTextEntryThroughModelJsonApi =>
  resource.type === 'TagTextEntryThroughModel';
