import API from '../api';
import {ITagJsonApi} from '../TagList';

interface ITagJsonApiResponse {
  data: ITagJsonApi[];
  links: {
    next: string;
  };
}

export function sort(order: string, array: Array<ITagJsonApi>): ITagJsonApi[] {
  let sortedArray: Array<ITagJsonApi>;
  if (order === 'name') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === '-name') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === 'date_created') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === '-date_created') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === 'date_updated') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === '-date_updated') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === 'date_last_used') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === '-date_last_used') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === 'entry_count') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === '-entry_count') {
    sortedArray = array.slice().sort((a, b) => {
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
  } else if (order === 'order') {
    sortedArray = array.slice().sort((a, b) => {
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

export function fetch(
  tags: ITagJsonApi[],
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

  const f: Promise<ITagJsonApi[]> = API.get<ITagJsonApiResponse>('/tags', {
    params: params,
  }).then(response => {
    tags = tags.concat(response.data.data);
    if (response.data.links.next === null) {
      return tags;
    }
    return fetch(tags, user, ++page, since);
  });
  return f;
}
