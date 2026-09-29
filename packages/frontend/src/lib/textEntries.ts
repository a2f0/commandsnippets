import type {IncludedResource} from '@commandsnippets/api-shared';
import type {Theme} from '@mui/material/styles';
import type {RefObject} from 'react';
import {apiClient} from './api/apiClient';
import type {EntriesQueryParams, IEntryFetchPage} from './api/requests/types';
import type {
  ITagTextEntryThroughModelJsonApi,
  ITextEntryJsonApi,
} from './api/responses/types';
import {db} from './db/db';
import type {Store} from './store/store';
import {convertISO8601ToUnixTime} from './util/dateTime';

export function sort(
  username: string,
  tag: string | null,
  inputArray: Array<ITextEntryJsonApi>,
  sortOrder: string,
  store: Store
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
    tagTextEntryThroughModelFilteredAndOrdered?.forEach(element => {
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
      tagTextEntryThroughModelFiltered.forEach(element => {
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
              .includes(store.entrySearchString.toLowerCase()) ||
            textEntry.attributes.subject
              .toLowerCase()
              .includes(store.entrySearchString.toLowerCase())
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
        if (sort1 < sort2) {
          return -1;
        }
        if (sort1 > sort2) {
          return 1;
        }
        // equal
        return 0;
      });
    } else if (sortOrder === '-body') {
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
    } else if (sortOrder === 'date_created') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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
    } else if (sortOrder === '-date_created') {
      sortedArray = textEntriesFiltered.slice().sort((a, b) => {
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

/**
 * The user's entries (tagged `tagId`, and with `tag_count` tags, when not
 * null) changed `since` (all when null), and the resources included with
 * them, from `page` on: added to `entries`.
 */
export function fetch(
  entries: IncludedResource[],
  user: string,
  tagId: string | null,
  page: number,
  since: string | null,
  tag_count: number | null
): Promise<IncludedResource[]> {
  const params: EntriesQueryParams = {
    'page[number]': page,
    'filter[user.username]': user,
    sort: 'date_updated',
    include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
  };

  if (since !== null) {
    params['filter[date_updated.gt]'] = since;
  }

  if (tagId !== null) {
    params['filter[tags.id]'] = Number(tagId);
  }

  if (tag_count !== null) {
    params['filter[tag_count]'] = tag_count;
  }

  return apiClient.getEntries(params).then(response => {
    const updatedEntries = entries.concat(response.data);
    for (const item of response.included ?? []) {
      if (!updatedEntries.includes(item)) {
        updatedEntries.push(item);
      }
    }
    if (response.links.next === null) {
      return updatedEntries;
    }
    return fetch(updatedEntries, user, tagId, page + 1, since, tag_count);
  });
}

export function fetchPage({
  page,
  username,
  sort,
  search,
  signal,
}: IEntryFetchPage): Promise<IncludedResource[]> {
  let entries: IncludedResource[] = [];
  const params: EntriesQueryParams = {
    'page[number]': page,
    'filter[user.username]': username,
    sort: sort,
    include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
  };

  if (search != null) {
    params['filter[search]'] = search;
  }

  return apiClient
    .getEntries({
      ...params,
      signal,
    })
    .then(response => {
      entries = entries.concat(response.data);
      for (const item of response.included ?? []) {
        if (!entries.includes(item)) {
          entries.push(item);
        }
      }
      return entries;
    });
}

export function needsScrollingIntoView(
  element:
    | RefObject<HTMLDivElement | null>
    | RefObject<HTMLButtonElement | null>
    | RefObject<HTMLLIElement | null>
    | null,
  theme: Theme
) {
  if (element === null) {
    return false;
  }
  const rect = element.current?.getBoundingClientRect();
  if (rect !== undefined) {
    const bottomInView =
      rect.bottom <=
      (window.innerHeight - theme.footer.height ||
        document.documentElement.clientHeight - theme.footer.height);
    if (bottomInView === false) {
      return true;
    }

    const topInView = rect.top >= theme.appBar.height;

    if (topInView === false) {
      return true;
    }
  } else {
    throw new Error('needsScrollingIntoView expects rectangle');
  }
  return false;
}

export async function fetchAllEntriesForUser(username: string | undefined) {
  if (db !== undefined) {
    if (username === undefined) {
      console.info('Cannot fetch all entried for undefined user.');
    } else {
      const entries = await fetch([], username, null, 1, null, null);
      for (const entry of entries) {
        if (entry.type === 'TextEntryReused') {
          throw new Error('unexpected type!');
        }
        const updated = convertISO8601ToUnixTime(entry.attributes.date_updated);
        if (entry.type === 'User') {
          await db.putUser({
            id: entry.id,
            username: entry.attributes.username,
            updated,
          });
        } else if (entry.type === 'Tag') {
          await db.putTag({
            id: entry.id,
            name: entry.attributes.name,
            entryCount: entry.attributes.entry_count,
            updated,
            userId: entry.relationships.user.data.id,
            synced: false,
            deleted: false,
          });
        } else if (entry.type === 'TextEntry') {
          await db.putEntry({
            id: entry.id,
            userId: entry.relationships.user.data.id,
            subject: entry.attributes.subject,
            body: entry.attributes.body,
            updated,
            synced: false,
            deleted: false,
          });
        } else {
          await db.putJunction({
            id: entry.id,
            entryId: entry.relationships.text_entry.data.id,
            userId: entry.relationships.user.data.id,
            tagId: entry.relationships.tag.data.id,
            order: entry.attributes.order,
            updated,
            synced: false,
            deleted: false,
          });
        }
      }
    }
  } else {
    throw new Error('db is undefined');
  }
}
