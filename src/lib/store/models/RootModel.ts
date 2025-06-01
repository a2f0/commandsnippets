import {types} from 'mobx-state-tree';
import {destroy, flow} from 'mobx-state-tree';

import {
  activeEntryEditField,
  activeSearch,
  activeTagEditField,
  appMode,
  entrySearchMethod,
} from '../../shared';
import {TagHelpers, TagModel} from './../models/TagModel';
import type {ITagJsonApi} from './../models/TagModel';
import {
  type ITagTextEntryThroughModelJsonApi,
  TagTextEntryThroughModel,
} from './../models/TagTextEntryThroughModel';
import {
  type ITextEntryJsonApi,
  TextEntryHelpers,
  TextEntryModel,
} from './../models/TextEntryModel';
import {type IUserJsonApi, UserModel} from './../models/UserModel';

export const RootModel = types
  .model({
    tagsArray: types.array(TagModel),
    textEntriesArray: types.array(TextEntryModel),
    untaggedTextEntriesArray: types.array(TextEntryModel),
    tagTextEntryThroughModel: types.array(TagTextEntryThroughModel),
    usersArray: types.array(UserModel),
    loggedInUser: types.maybeNull(types.string),
    selectedTheme: types.string,
    tagSortOrder: types.string,
    entryNew: types.maybeNull(types.string),
    tagTextEntryThroughModelSortOrder: types.string,
    entrySortOrder: types.string,
    tagNew: types.maybeNull(types.string),
    tagSearch: types.boolean,
    mostRecentCopyType: types.maybeNull(types.string),
    mostRecentCopyID: types.maybeNull(types.string),
    currentTag: types.maybeNull(types.string),
    currentUser: types.maybeNull(types.string),
    showTagCounts: types.boolean,
    allEntriesCacheTimestamp: types.string,
  })
  .volatile<{
    activeSearch: activeSearch;
    activeEntryEditField: activeEntryEditField;
    activeTagEditField: activeTagEditField;
    clickCount: number;
    entrySelectedID: string;
    entrySearchString: string;
    entrySearchMethod: entrySearchMethod;
    tagSearchString: string;
    tagSelectedID: string;
    appMode: appMode;
  }>(() => ({
    activeSearch: activeSearch.tags,
    activeEntryEditField: activeEntryEditField.subject,
    activeTagEditField: activeTagEditField.name,
    clickCount: 0,
    entrySelectedID: '',
    entrySearchString: '',
    entrySearchMethod: entrySearchMethod.currentTagOnly,
    tagSearchString: '',
    tagSelectedID: '',
    appMode: appMode.tagsList,
  }))
  .actions(self => ({
    updateOrCreateTextEntry(object: ITextEntryJsonApi) {
      const existing = self.textEntriesArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.textEntriesArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateUntaggedTextEntry(object: ITextEntryJsonApi) {
      const existing = self.untaggedTextEntriesArray.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.untaggedTextEntriesArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateTag(object: ITagJsonApi) {
      const existing = self.tagsArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.tagsArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateTagTextEntryThroughModel(
      object: ITagTextEntryThroughModelJsonApi
    ) {
      const existing = self.tagTextEntryThroughModel.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.tagTextEntryThroughModel.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateUser(object: IUserJsonApi) {
      const existing = self.usersArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.usersArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
  }))
  .actions(self => ({
    reconcileCollection(
      collection: Array<
        | ITextEntryJsonApi
        | ITagTextEntryThroughModelJsonApi
        | IUserJsonApi
        | ITagJsonApi
      >
    ) {
      // type guard
      const text_entries: ITextEntryJsonApi[] = collection.filter(
        (i): i is ITextEntryJsonApi => {
          return i.type === 'TextEntry';
        }
      );
      text_entries.map(element => {
        self.updateOrCreateTextEntry(element);
      });

      const tag_text_entry_through_models: ITagTextEntryThroughModelJsonApi[] =
        collection.filter((i): i is ITagTextEntryThroughModelJsonApi => {
          return i.type === 'TagTextEntryThroughModel';
        });
      tag_text_entry_through_models.map(element => {
        self.updateOrCreateTagTextEntryThroughModel(element);
      });

      const users: IUserJsonApi[] = collection.filter(
        (i): i is IUserJsonApi => {
          return i.type === 'User';
        }
      );
      users.map(element => {
        self.updateOrCreateUser(element);
      });

      const tags: ITagJsonApi[] = collection.filter((i): i is ITagJsonApi => {
        return i.type === 'Tag';
      });
      tags.map(element => {
        self.updateOrCreateTag(element);
      });
    },
  }))
  .actions(self => ({
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        const existingUser = self.usersArray.find(
          o => o.attributes.username === user
        );
        let filteredTags: Array<ITagJsonApi> = [];
        if (existingUser !== undefined) {
          filteredTags = self.tagsArray.filter(element => {
            return element.relationships.user.data.id === existingUser.id;
          });
        }
        const mostRecentTimestamp: string | null =
          TagHelpers.getMostRecentTimeStamp(filteredTags);
        const collection = yield TagHelpers.fetch(
          [],
          user,
          1,
          mostRecentTimestamp
        );
        self.reconcileCollection(collection);
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    // Sync All Text Entries Based on a Cache Timestamp
    syncTextEntries() {},
    fetchTextEntries: flow(function* fetchTextEntries(
      user: string,
      tag: string
    ) {
      try {
        const userObject = self.usersArray.find(
          element => element.attributes.username === user
        );

        const textEntriesFiltered: ITextEntryJsonApi[] = [];

        const tagObject = self.tagsArray.find(
          element =>
            element.attributes.name === tag &&
            element.relationships.user.data.id === userObject?.id
        );

        const tagTextEntryThroughModelFiltered =
          self.tagTextEntryThroughModel.filter(
            element => element.relationships.tag.data.id === tagObject?.id
          );

        tagTextEntryThroughModelFiltered.map(element => {
          const entry = self.textEntriesArray.find(textEntry => {
            return textEntry.id === element.relationships.text_entry.data.id;
          });
          if (entry !== undefined) {
            textEntriesFiltered.push(entry);
          }
        });

        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(textEntriesFiltered);
        const collection = yield TextEntryHelpers.fetch(
          [],
          user,
          tag,
          1,
          mostRecentTimestamp,
          null
        );
        self.reconcileCollection(collection);
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    fetchUntaggedTextEntries: flow(function* fetchUntaggedTextEntries(
      user: string
    ) {
      try {
        const existingUser = self.usersArray.find(
          o => o.attributes.username === user
        );
        let filteredTextEntries: Array<ITextEntryJsonApi> = [];
        if (existingUser !== undefined) {
          filteredTextEntries = self.untaggedTextEntriesArray.filter(
            element => {
              return element.relationships.user.data.id === existingUser.id;
            }
          );
        }
        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(filteredTextEntries);
        const collection: Array<
          | ITextEntryJsonApi
          | ITagTextEntryThroughModelJsonApi
          | IUserJsonApi
          | ITagJsonApi
        > = yield TextEntryHelpers.fetch(
          [],
          user,
          null,
          1,
          mostRecentTimestamp,
          0
        );
        // type guard
        const text_entries: ITextEntryJsonApi[] = collection.filter(
          (i): i is ITextEntryJsonApi => {
            return i.type === 'TextEntry';
          }
        );
        text_entries.map(element => {
          self.updateOrCreateUntaggedTextEntry(element);
        });
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    incrementClickCount() {
      self.clickCount += 1;
    },
    setLoggedInUser(handle: string | null) {
      self.loggedInUser = handle;
    },
    removeTag(id: string) {
      const existingTag = self.tagsArray.find(c => c.id === id);
      if (existingTag) {
        destroy(existingTag);
      }
    },
    removeTagTextEntryThroughModel(id: string) {
      const existingJunction = self.tagTextEntryThroughModel.find(
        c => c.id === id
      );
      if (existingJunction) {
        destroy(existingJunction);
      }
    },
    removeUntaggedTextEntry(id: string) {
      const existingEntry = self.untaggedTextEntriesArray.find(
        c => c.id === id
      );
      if (existingEntry) {
        destroy(existingEntry);
      }
    },
    removeTextEntry(id: string) {
      console.info`(id: ${id})`;
    },
    setActiveSearch(activeSearch: activeSearch) {
      self.activeSearch = activeSearch;
    },
    setSelectedTheme(theme: string) {
      self.selectedTheme = theme;
    },
    setTagSortOrder(order: string) {
      self.tagSortOrder = order;
    },
    setEntryNew(value: string | null) {
      self.entryNew = value;
    },
    setEntrySelectedID(value: string) {
      self.entrySelectedID = value;
    },
    setEntrySearchMethod(method: entrySearchMethod) {
      self.entrySearchMethod = method;
    },
    setTagTextEntryThroughModelSortOrder(order: string) {
      self.tagTextEntryThroughModelSortOrder = order;
    },
    setEntrySortOrder(order: string) {
      self.entrySortOrder = order;
    },
    setTagNew(value: string | null) {
      self.tagNew = value;
    },
    setActiveEntryEditField(value: activeEntryEditField) {
      self.activeEntryEditField = value;
    },
    setActiveTagEditField(value: activeTagEditField) {
      self.activeTagEditField = value;
    },
    setAppMode(value: appMode) {
      self.appMode = value;
    },
    setTagSearch(value: boolean) {
      self.tagSearch = value;
    },
    setTagSelectedID(value: string) {
      self.tagSelectedID = value;
    },
    setTagSearchString(value: string) {
      self.tagSearchString = value;
    },
    setEntrySearchString(value: string) {
      self.entrySearchString = value;
    },
    setMostRecentCopyType(value: string) {
      self.mostRecentCopyType = value;
    },
    setMostRecentCopyID(value: string) {
      self.mostRecentCopyID = value;
    },
    setCurrentTag(value: string | null) {
      self.currentTag = value;
    },
    setCurrentUser(value: string | null) {
      self.currentUser = value;
    },
    setShowTagCounts(value: boolean) {
      self.showTagCounts = value;
    },
  }));
