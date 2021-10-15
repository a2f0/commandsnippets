import API from '../api';
import {ITagTextEntryThroughModelJsonApi} from '../models/TagTextEntryThroughModel';
import {ITextEntryJsonApi} from '../models/TextEntryModel';
import {IUserJsonApi} from '../models/UserModel';
import {store} from '../AppStateStore';

interface ITextEntryJsonApiResponse {
  data: Array<ITextEntryJsonApi>;
  links: {
    next: string;
  };
  included: Array<ITagTextEntryThroughModelJsonApi>;
}

export function sort(): ITextEntryJsonApi[] {
  let sortedArray: Array<ITextEntryJsonApi> = [];
  const userObject = store.usersArray.find(
    element => element.attributes.username === store.currentUser
  );

  const tagObject = store.tagsArray.find(
    element =>
      element.attributes.name === store.currentTag &&
      element.relationships.user.data.id === userObject?.id
  );

  // Get the junction entries for the current tag.
  const tagTextEntryThroughModelFiltered =
    store.tagTextEntryThroughModel.filter(
      element => element.relationships.tag.data.id === tagObject?.id
    );

  // Rearrange the junction entries if necessary.
  if (
    store.entrySortOrder === 'order' ||
    store.entrySortOrder === 'date_tagged' ||
    store.entrySortOrder === '-date_tagged'
  ) {
    // Then it is a sort based on the junction table.
    let tagTextEntryThroughModelFilteredAndOrdered: ITagTextEntryThroughModelJsonApi[] =
      [];
    if (store.entrySortOrder === 'order') {
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
    } else if (store.entrySortOrder === 'date_tagged') {
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
    } else if (store.entrySortOrder === '-date_tagged') {
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
      const entry = store.textEntriesArray.find(textEntry => {
        return textEntry.id === element.relationships.text_entry.data.id;
      });
      if (entry !== undefined) {
        sortedArray.push(entry);
      }
    });
  } else {
    // Then its a sort order on directly attached attribute.

    // Get all of the entries.
    const textEntriesFiltered: ITextEntryJsonApi[] = [];
    tagTextEntryThroughModelFiltered.map(element => {
      const entry = store.textEntriesArray.find(textEntry => {
        return textEntry.id === element.relationships.text_entry.data.id;
      });
      if (entry !== undefined) {
        textEntriesFiltered.push(entry);
      }
    });

    if (store.entrySortOrder === 'subject') {
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
    } else if (store.entrySortOrder === '-subject') {
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
    } else if (store.entrySortOrder === 'body') {
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
    } else if (store.entrySortOrder === '-body') {
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
    } else if (store.entrySortOrder === 'date_created') {
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
    } else if (store.entrySortOrder === '-date_created') {
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
    } else if (store.entrySortOrder === 'date_updated') {
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
    } else if (store.entrySortOrder === '-date_updated') {
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
    } else if (store.entrySortOrder === 'tag_count') {
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
    } else if (store.entrySortOrder === '-tag_count') {
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
    } else if (store.entrySortOrder === 'order') {
      return store.textEntriesArray;
    } else {
      throw `Unknown sort order: ${store.entrySortOrder}`;
    }
  }
  return sortedArray;
}

export function getMostRecentTimeStamp(
  array: ITextEntryJsonApi[]
): string | null {
  let mostRecentTimestamp: string | null = null;
  if (array.length > 0) {
    const sortedArray: Array<ITextEntryJsonApi> = array.slice().sort((a, b) => {
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

export function filter(
  order: string,
  array: Array<ITextEntryJsonApi>
): ITextEntryJsonApi[] {
  const filteredArray: Array<ITextEntryJsonApi> = array;
  return filteredArray;
}

export function fetch(
  entries: Array<
    ITextEntryJsonApi | ITagTextEntryThroughModelJsonApi | IUserJsonApi
  >,
  user: string,
  tag: string,
  page: number,
  since: string | null
) {
  interface IParams {
    'page[number]': number;
    'filter[user.username]': string;
    'filter[tags.name]': string;
    sort: string;
    'filter[date_updated.gt]'?: string;
    include: string;
  }

  const params: IParams = {
    'page[number]': page,
    'filter[user.username]': user,
    'filter[tags.name]': tag,
    sort: 'date_updated',
    include: 'text_entry_to_tag.tag,text_entry_to_tag.user,user',
  };

  const f: Promise<
    Array<ITextEntryJsonApi | ITagTextEntryThroughModelJsonApi | IUserJsonApi>
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
    return fetch(entries, user, tag, ++page, since);
  });
  return f;
}
