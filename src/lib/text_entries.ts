import API from './api/apiBase';
import {CancelTokenSource} from 'axios';
import {ITagJsonApi} from '../models/TagModel';
import {ITagTextEntryThroughModelJsonApi} from '../models/TagTextEntryThroughModel';
import {ITextEntryJsonApi} from '../models/TextEntryModel';
import {IUserJsonApi} from '../models/UserModel';
import type {TStore} from '../AppStateStore';
import {Theme} from '@mui/material/styles';
import {convertISO8601ToUnixTime} from './util/dateTime';
import {db} from '../../src/lib/db/db';

export interface ITextEntryJsonApiResponse {
  data: Array<ITextEntryJsonApi>;
  links: {
    next: string | null;
  };
  included: Array<
    | ITagTextEntryThroughModelJsonApi
    | ITextEntryJsonApi
    | ITagJsonApi
    | IUserJsonApi
    | ITagJsonApi
  >;
}

export interface ITextEntryJsonApiResponseSingle {
  data: ITextEntryJsonApi;
  included: Array<ITagTextEntryThroughModelJsonApi>;
}

export interface IEntryFetchPage {
  page: number;
  username: string;
  sort: string;
  search?: string;
  source: CancelTokenSource;
}

export function sort(
  username: string,
  tag: string | null,
  inputArray: Array<ITextEntryJsonApi>,
  sortOrder: string,
  store: TStore
): ITextEntryJsonApi[] {
  let sortedArray: Array<ITextEntryJsonApi> = [];
  const userObject = store.usersArray.find(
    element => element.attributes.username === username
  );

  const tagObject = store.tagsArray.find(
    element =>
      element.attributes.name === tag &&
      element.relationships.user.data.id === userObject?.id
  );

  // Get the junction entries for the current tag.
  const tagTextEntryThroughModelFiltered =
    store.tagTextEntryThroughModel.filter(
      element => element.relationships.tag.data.id === tagObject?.id
    );

  // Sort attributes for the junction.
  if (
    sortOrder === 'order' ||
    sortOrder === 'date_tagged' ||
    sortOrder === '-date_tagged'
  ) {
    // Then it is a sort based on the junction table.
    let tagTextEntryThroughModelFilteredAndOrdered: ITagTextEntryThroughModelJsonApi[] =
      [];
    if (sortOrder === 'order') {
      tagTextEntryThroughModelFilteredAndOrdered =
        tagTextEntryThroughModelFiltered.sort((a, b) => {
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
    } else if (sortOrder === 'date_tagged') {
      tagTextEntryThroughModelFilteredAndOrdered =
        tagTextEntryThroughModelFiltered.sort((a, b) => {
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
    } else if (sortOrder === '-date_tagged') {
      tagTextEntryThroughModelFilteredAndOrdered =
        tagTextEntryThroughModelFiltered.sort((a, b) => {
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
    }
    tagTextEntryThroughModelFilteredAndOrdered?.map(element => {
      if (store.entrySearchString !== '') {
        const entry = inputArray.find(textEntry => {
          return (
            textEntry.id === element.relationships.text_entry.data.id &&
            (textEntry.attributes.body
              .toLowerCase()
              .includes(store.entrySearchString.toLowerCase()) ||
              textEntry.attributes.subject
                .toLowerCase()
                .includes(store.entrySearchString.toLowerCase()))
          );
        });
        if (entry !== undefined) {
          sortedArray.push(entry);
        }
      } else {
        const entry = inputArray.find(textEntry => {
          return textEntry.id === element.relationships.text_entry.data.id;
        });
        if (entry !== undefined) {
          sortedArray.push(entry);
        }
      }
    });
  } else {
    // Then its a sort order on directly attached attribute.

    // Get all of the entries.
    let textEntriesFiltered: ITextEntryJsonApi[] = [];

    if (tag !== null) {
      tagTextEntryThroughModelFiltered.map(element => {
        if (store.entrySearchString !== '') {
          const entry = inputArray.find(textEntry => {
            return (
              textEntry.id === element.relationships.text_entry.data.id &&
              (textEntry.attributes.body
                .toLowerCase()
                .includes(store.entrySearchString.toLowerCase()) ||
                textEntry.attributes.subject
                  .toLowerCase()
                  .includes(store.entrySearchString.toLowerCase()))
            );
          });
          if (entry !== undefined) {
            textEntriesFiltered.push(entry);
          }
        } else {
          const entry = inputArray.find(textEntry => {
            return textEntry.id === element.relationships.text_entry.data.id;
          });
          if (entry !== undefined) {
            textEntriesFiltered.push(entry);
          }
        }
      });
    } else {
      // Then it doesn't need to be filtered by tag.
      // But it might need to be filtered by search string.
      if (store.entrySearchString !== '') {
        const filtered = inputArray.filter(textEntry => {
          return (
            textEntry.attributes.body
              .toLowerCase()
              .includes(store.entrySearchString) ||
            textEntry.attributes.subject
              .toLowerCase()
              .includes(store.entrySearchString)
          );
        });
        textEntriesFiltered = filtered;
      } else {
        textEntriesFiltered = inputArray;
      }
    }

    if (sortOrder === 'subject') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.subject.toUpperCase(); // ignore upper and lowercase
        const sort2 = b.attributes.subject.toUpperCase(); // ignore upper and lowercase
        if (sort1 < sort2) {
          return -1;
        }
        if (sort1 > sort2) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === '-subject') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.subject.toUpperCase(); // ignore upper and lowercase
        const sort2 = b.attributes.subject.toUpperCase(); // ignore upper and lowercase
        if (sort2 < sort1) {
          return -1;
        }
        if (sort2 > sort1) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === 'body') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.body.toUpperCase(); // ignore upper and lowercase
        const sort2 = b.attributes.body.toUpperCase(); // ignore upper and lowercase
        if (sort2 < sort1) {
          return -1;
        }
        if (sort2 > sort1) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === '-body') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.body.toUpperCase(); // ignore upper and lowercase
        const sort2 = b.attributes.body.toUpperCase(); // ignore upper and lowercase
        if (sort1 < sort2) {
          return -1;
        }
        if (sort1 > sort2) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === 'date_created') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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
    } else if (sortOrder === '-date_created') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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
    } else if (sortOrder === 'date_updated') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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
    } else if (sortOrder === '-date_updated') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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
    } else if (sortOrder === 'tag_count') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.tag_count; // ignore upper and lowercase
        const sort2 = b.attributes.tag_count; // ignore upper and lowercase
        if (sort1 < sort2) {
          return -1;
        }
        if (sort1 > sort2) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === '-tag_count') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
        const sort1 = a.attributes.tag_count; // ignore upper and lowercase
        const sort2 = b.attributes.tag_count; // ignore upper and lowercase
        if (sort2 < sort1) {
          return -1;
        }
        if (sort2 > sort1) {
          return 1;
        }
        // equal
        return 0;
      });
    } else {
      throw `Unknown sort order: ${sortOrder}`;
    }
  }
  // Remove MobX Proxy
  const plainObjects = JSON.parse(JSON.stringify(sortedArray));

  return plainObjects;
}

export function filter(
  order: string,
  array: Array<ITextEntryJsonApi>
): ITextEntryJsonApi[] {
  const filteredArray: Array<ITextEntryJsonApi> = array;
  return filteredArray;
}

interface IFetchParams {
  'page[number]': number;
  'filter[user.username]': string;
  'filter[tags.name]'?: string;
  sort: string;
  'filter[date_updated.gt]'?: string;
  include: string;
  'filter[tag_count]'?: number;
  'filter[search]'?: string;
}

export function fetch(
  entries: Array<
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
  >,
  user: string,
  tag: string | null,
  page: number,
  since: string | null,
  tag_count: number | null
) {
  const params: IFetchParams = {
    'page[number]': page,
    'filter[user.username]': user,
    sort: 'date_updated',
    include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
  };

  if (since !== null) {
    params['filter[date_updated.gt]'] = since;
  }

  if (tag !== null) {
    params['filter[tags.name]'] = tag;
  }

  if (tag_count !== null) {
    params['filter[tag_count]'] = tag_count;
  }

  const f: Promise<
    Array<
      | ITextEntryJsonApi
      | ITagTextEntryThroughModelJsonApi
      | IUserJsonApi
      | ITagJsonApi
    >
  > = API.get<ITextEntryJsonApiResponse>('/entries', {
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
    return fetch(entries, user, tag, ++page, since, tag_count);
  });
  return f;
}

export function fetchPage({
  page,
  username,
  sort,
  search,
  source,
}: IEntryFetchPage) {
  let entries: Array<
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
  > = [];
  const params: IFetchParams = {
    'page[number]': page,
    'filter[user.username]': username,
    'filter[search]': search,
    sort: sort,
    include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
  };

  if (search !== null) {
    params['filter[search]'] = search;
  }

  const f: Promise<void | Array<
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
  >> = API.get<ITextEntryJsonApiResponse>('/entries', {
    params: params,
    cancelToken: source.token,
  }).then(response => {
    entries = entries.concat(response.data.data);
    for (let i = 0; i < response.data.included?.length; i++) {
      if (!entries.includes(response.data.included[i])) {
        entries.push(response.data.included[i]);
      }
    }
    return entries;
  });
  return f;
}

export function needsScrollingIntoView(
  element: HTMLButtonElement,
  theme: Theme
) {
  const rect = element.getBoundingClientRect();
  if (rect !== undefined) {
    // Then it exists
    const bottomInView =
      rect.bottom <=
      (window.innerHeight - theme.footer.height ||
        document.documentElement.clientHeight - theme.footer.height);
    if (bottomInView === false) {
      // Then it needs to be scrolled
      return true;
    }
  }
  return false;
}

function isAUser(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is IUserJsonApi {
  return obj.type === 'User';
}

function isATag(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITagJsonApi {
  return obj.type === 'Tag';
}

function isATextEntry(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITextEntryJsonApi {
  return obj.type === 'TextEntry';
}

function isAJunction(
  obj:
    | ITextEntryJsonApi
    | ITagTextEntryThroughModelJsonApi
    | IUserJsonApi
    | ITagJsonApi
): obj is ITextEntryJsonApi {
  return obj.type === 'TagTextEntryThroughModel';
}

export async function fetchAllEntriesForUser(username: string | undefined) {
  if (db !== undefined) {
    if (username === undefined) {
      console.info('Cannot fetch all entried for undefined user.');
    } else {
      const entries = await fetch([], username, null, 13, null, null);
      for (const entry of entries) {
        const updated = convertISO8601ToUnixTime(entry.attributes.date_updated);
        if (isAUser(entry)) {
          await db.putUser({
            id: entry.id,
            username: entry.attributes.username,
            updated,
          });
        } else if (isATag(entry)) {
          await db.putTag({
            id: entry.id,
            name: entry.attributes.name,
            entryCount: entry.attributes.entry_count,
            updated,
            userId: entry.relationships.user.data.id,
          });
        } else if (isATextEntry(entry)) {
          await db.putEntry({
            id: entry.id,
            subject: entry.attributes.subject,
            body: entry.attributes.body,
            updated,
          });
        } else if (isAJunction(entry)) {
          db.putJunction({
            id: entry.id,
            entryId: entry.relationships.text_entry.data.id,
            userId: entry.relationships.tag.data.id,
            tagId: entry.relationships.tag.data.id,
            order: entry.attributes.order,
            updated,
          });
        } else {
          throw new Error('unexpected type!');
        }
      }
    }
  } else {
    throw new Error('db is undefined');
  }
}
