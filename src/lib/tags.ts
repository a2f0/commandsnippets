import type {Store} from './store/store';
import type {ITagJsonApi} from './store/models/TagModel';
import type {IUserJsonApi} from './store/models/UserModel';
import {apiBase} from './api/apiBase';

export interface ITagJsonApiResponse {
  data: ITagJsonApi[];
  links: {
    next: string | null;
  };
  included?: Array<IUserJsonApi>;
}

export interface ITagJsonApiResponseSingle {
  data: ITagJsonApi;
  included: Array<IUserJsonApi>;
}

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
  } else if (store.tagSortOrder === '-date_created') {
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
      const sort1 = new Date(a.attributes.date_last_used);
      const sort2 = new Date(b.attributes.date_last_used);
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
      const sort1 = new Date(a.attributes.date_last_used);
      const sort2 = new Date(b.attributes.date_last_used);
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

export function fetch(
  entries: Array<ITagJsonApi | IUserJsonApi>,
  user: string,
  page: number,
  since: string | null
) {
  interface IParams {
    'page[number]': number;
    'filter[user.username]': string;
    sort: string;
    'filter[date_updated.gt]'?: string;
  }

  const params: IParams = {
    'page[number]': page,
    'filter[user.username]': user,
    sort: 'date_updated',
  };

  if (since !== null) {
    params['filter[date_updated.gt]'] = since;
  }

  const f: Promise<Array<ITagJsonApi | IUserJsonApi>> = apiBase
    .get<ITagJsonApiResponse>('/tags', {
      params: params,
    })
    .then(response => {
      const updatedEntries = entries.concat(response.data.data);
      if (response.data.included) {
        for (let i = 0; i < response.data.included.length; i++) {
          const item = response.data.included[i];
          if (item && !updatedEntries.includes(item)) {
            updatedEntries.push(item);
          }
        }
      }
      if (response.data.links.next === null) {
        return updatedEntries;
      }
      return fetch(updatedEntries, user, page + 1, since);
    });
  return f;
}
