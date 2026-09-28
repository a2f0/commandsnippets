import type {
  ITagJsonApi,
  ITagTextEntryThroughModelJsonApi,
  ITextEntryJsonApi,
  IUserJsonApi,
} from '../../src/lib/api/responses/types';
import {defaultState} from '../../src/lib/shared';
import {RootModel} from '../../src/lib/store/models/RootModel';
import type {Store} from '../../src/lib/store/store';

const date = '2020-01-01T00:00:00';

export const testUser: IUserJsonApi = {
  id: '1',
  type: 'User',
  attributes: {username: 'test', date_updated: date},
};

const owner = {user: {data: {id: testUser.id, type: 'User'}}};

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
  attributes: Partial<ITextEntryJsonApi['attributes']>
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
      tag_count: 0,
      ...attributes,
    },
    relationships: owner,
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
    attributes: {order: Number(id), date_updated: date, date_created: date},
    relationships: {
      tag: {data: {id: tagId, type: 'Tag'}},
      text_entry: {data: {id: entryId, type: 'TextEntry'}},
    },
  };
}

/**
 * A store of its own (not the app's `store`), signed in as `testUser` and
 * holding `resources`: tagged entries, tags and their junctions.
 */
export function createStore(
  resources: Array<
    ITagJsonApi | ITextEntryJsonApi | ITagTextEntryThroughModelJsonApi
  > = []
): Store {
  const store = RootModel.create(defaultState);
  store.setLoggedInUser(testUser.attributes.username);
  store.setCurrentUser(testUser.attributes.username);
  store.reconcileCollection([testUser, ...resources]);
  return store;
}
