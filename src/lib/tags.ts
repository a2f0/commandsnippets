import API from '../api';
import {ITagJsonApi} from '../models/TagModel';
import {IUserJsonApi} from '../models/UserModel';
import {store} from '../AppStateStore';

interface ITagJsonApiResponse {
  data: ITagJsonApi[];
  links: {
    next: string;
  };
  included: Array<IUserJsonApi>;
}

export function sort(): ITagJsonApi[] {
  let sortedArray: Array<ITagJsonApi>;

  const userObject = store.usersArray.find(
    element => element.attributes.username === store.currentUser
  );

  const tagObjects = store.tagsArray.filter(
    element => element.relationships.user.data.id === userObject?.id
  );

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
  return sortedArray;
}

export function getMostRecentTimeStamp(array: ITagJsonApi[]): string | null {
  let mostRecentTimestamp: string | null = null;
  if (array.length > 0) {
    const sortedArray: Array<ITagJsonApi> = array.sort((a, b) => {
      const sort1 = new Date(a.attributes.date_updated);
      const sort2 = new Date(b.attributes.date_updated);
      if (sort2 < sort1) {
        return -1;
      }
      if (sort2 > sort1) {
        return 1;
      }
      return 0;
    });
    mostRecentTimestamp = sortedArray[0].attributes.date_updated;
  }
  return mostRecentTimestamp;
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

  const f: Promise<Array<ITagJsonApi | IUserJsonApi>> =
    API.get<ITagJsonApiResponse>('/tags', {
      params: params,
    }).then(response => {
      entries = entries.concat(response.data.data);
      for (let i = 0; i < response.data.included?.length; i++) {
        if (!entries.includes(response.data.included[i])) {
          entries.push(response.data.included[i]);
        }
      }
      if (response.data.links.next === null) {
        return entries;
      }
      return fetch(entries, user, ++page, since);
    });
  return f;
}
