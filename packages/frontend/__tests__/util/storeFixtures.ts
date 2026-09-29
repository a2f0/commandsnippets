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

/** Store `resources` in the signed-in user's IndexedDB database. */
export async function seed(
  resources: ReadonlyArray<
    ITagJsonApi | ITextEntryJsonApi | ITagTextEntryThroughModelJsonApi
  >
): Promise<void> {
  const {db} = syncSession(testUser.attributes.username);
  await db.tags.bulkPut(resources.filter(isTag));
  await db.entries.bulkPut(resources.filter(isEntry));
  await db.junctions.bulkPut(resources.filter(isJunction));
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
