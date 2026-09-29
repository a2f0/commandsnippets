import type {IncludedResource} from '@commandsnippets/api-shared';
import type {TagListParams} from '@commandsnippets/api-shared/requests';
import {apiClient} from './api/apiClient';
import {readPages} from './api/readPages';
import type {ITagJsonApi} from './api/responses/types';
import type {Store} from './store/store';

/** When a tag was last used, for sorting: never (null) is the epoch. */
const lastUsed = (tag: ITagJsonApi) =>
  new Date(tag.attributes.date_last_used ?? 0);

export function filterAndSort(store: Store): Array<ITagJsonApi> {
  let sortedArray: Array<ITagJsonApi>;

  const userObject = store.usersArray.find(
    element => element.attributes.username === store.currentUser
  );

  let tagObjects: Array<ITagJsonApi>;
  if (store.tagSearchString !== '') {
    tagObjects = store.tagsArray.filter(
      element =>
        element.relationships.user.data.id === userObject?.id &&
        element.attributes.is_deleted === false &&
        element.attributes.name
          .toLowerCase()
          .includes(store.tagSearchString.toLowerCase())
    );
  } else {
    tagObjects = store.tagsArray.filter(
      element =>
        element.relationships.user.data.id === userObject?.id &&
        element.attributes.is_deleted === false
    );
  }

  if (store.tagSortOrder === 'name') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = a.attributes.name.toUpperCase(); // ignore upper and lowercase
      const sort2 = b.attributes.name.toUpperCase(); // ignore upper and lowercase
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === '-name') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = a.attributes.name.toUpperCase(); // ignore upper and lowercase
      const sort2 = b.attributes.name.toUpperCase(); // ignore upper and lowercase
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === 'date_created') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = new Date(a.attributes.date_created);
      const sort2 = new Date(b.attributes.date_created);
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === '-date_created') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = new Date(a.attributes.date_created);
      const sort2 = new Date(b.attributes.date_created);
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === 'date_updated') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = new Date(a.attributes.date_updated);
      const sort2 = new Date(b.attributes.date_updated);
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === '-date_updated') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = new Date(a.attributes.date_updated);
      const sort2 = new Date(b.attributes.date_updated);
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === 'date_last_used') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = lastUsed(a);
      const sort2 = lastUsed(b);
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === '-date_last_used') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = lastUsed(a);
      const sort2 = lastUsed(b);
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === 'entry_count') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = a.attributes.entry_count; // ignore upper and lowercase
      const sort2 = b.attributes.entry_count; // ignore upper and lowercase
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === '-entry_count') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = a.attributes.entry_count; // ignore upper and lowercase
      const sort2 = b.attributes.entry_count; // ignore upper and lowercase
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (store.tagSortOrder === 'order') {
    sortedArray = tagObjects.sort((a, b) => {
      const sort1 = a.attributes.order;
      const sort2 = b.attributes.order;
      if (sort1 < sort2) {
        return -1;
      }
      if (sort1 > sort2) {
        return 1;
      }
      // equal
      return 0;
    });
  } else {
    throw 'Unknown sort order';
  }
  // Remove MobX Proxy
  const plainObjects = JSON.parse(JSON.stringify(sortedArray));

  return plainObjects;
}

/**
 * The user's tags changed `since` (all when null), and the resources
 * included with them, from every page (see readPages).
 */
export function fetch(
  user: string,
  since: string | null
): Promise<IncludedResource[]> {
  return readPages(page => {
    const params: TagListParams = {
      'page[number]': page,
      'filter[user.username]': user,
      sort: 'date_updated',
    };
    if (since !== null) {
      params['filter[date_updated.gt]'] = since;
    }
    return apiClient.getTags(params);
  });
}
