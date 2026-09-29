import type {IncludedResource} from '@commandsnippets/api-shared';
import {destroy, flow, types} from 'mobx-state-tree';
import type {
  ITagJsonApi,
  ITagTextEntryThroughModelJsonApi,
  ITextEntryJsonApi,
  IUserJsonApi,
  ResourceCollection,
} from '../../api/responses/types';
import {syncedThrough} from '../../revisions';
import {
  activeEntryEditField,
  activeSearch,
  activeTagEditField,
  appMode,
  entrySearchMethod,
} from '../../shared';
import {TagHelpers, TagModel} from './TagModel';
import {TagTextEntryThroughModel} from './TagTextEntryThroughModel';
import {TextEntryHelpers, TextEntryModel} from './TextEntryModel';
import {UserModel} from './UserModel';

/**
 * How far a tag's entries are synced (`syncTagEntries`): the tag's revision
 * then, and the newest entry revision its syncs have listed. Only syncs move
 * it, never the app's own writes, so a change another client made before one
 * of ours is never skipped.
 */
const TagSyncCursor = types.model('TagSyncCursor', {
  tag: types.string,
  entries: types.maybeNull(types.string),
});

export const RootModel = types
  .model({
    tagsArray: types.array(TagModel),
    textEntriesArray: types.array(TextEntryModel),
    untaggedTextEntriesArray: types.array(TextEntryModel),
    tagTextEntryThroughModel: types.array(TagTextEntryThroughModel),
    usersArray: types.array(UserModel),
    loggedInUser: types.maybeNull(types.string),
    // Whether the signed-in user is staff (offers the admin page). Optional so
    // snapshots saved before it existed still load.
    isStaff: types.optional(types.boolean, false),
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
    // The newest tag revision the tags syncs have listed (see TagSyncCursor).
    tagsSyncedThrough: types.maybeNull(types.string),
    // By tag id.
    tagSyncCursors: types.map(TagSyncCursor),
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
    // Advances whenever a sync changes the store (reconcileCollection,
    // pruneTagJunctions): a list shown from the store compares it to tell
    // whether any sync, its own or another's, changed what it shows.
    storeVersion: number;
    // When the latest tags sync started (Date.now()), for pacing them.
    tagsSyncedAt: number;
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
    storeVersion: 0,
    tagsSyncedAt: 0,
  }))
  .actions(self => ({
    // Each updateOrCreate returns whether it changed the store: a resource it
    // did not hold, or a newer revision of one it did.
    updateOrCreateTextEntry(object: ITextEntryJsonApi) {
      const existing = self.textEntriesArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.textEntriesArray.push(object);
        return true;
      }
      const existingTimestamp = new Date(existing.attributes.date_updated);
      const incomingTimeStamp = new Date(object.attributes.date_updated);
      if (incomingTimeStamp > existingTimestamp) {
        existing.update(object);
        return true;
      }
      return false;
    },
    updateOrCreateUntaggedTextEntry(object: ITextEntryJsonApi) {
      const existing = self.untaggedTextEntriesArray.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.untaggedTextEntriesArray.push(object);
        return true;
      }
      const existingTimestamp = new Date(existing.attributes.date_updated);
      const incomingTimeStamp = new Date(object.attributes.date_updated);
      if (incomingTimeStamp > existingTimestamp) {
        existing.update(object);
        return true;
      }
      return false;
    },
    updateOrCreateTag(object: ITagJsonApi) {
      const existing = self.tagsArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.tagsArray.push(object);
        return true;
      }
      const existingTimestamp = new Date(existing.attributes.date_updated);
      const incomingTimeStamp = new Date(object.attributes.date_updated);
      if (incomingTimeStamp > existingTimestamp) {
        existing.update(object);
        return true;
      }
      return false;
    },
    updateOrCreateTagTextEntryThroughModel(
      object: ITagTextEntryThroughModelJsonApi
    ) {
      const existing = self.tagTextEntryThroughModel.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.tagTextEntryThroughModel.push(object);
        return true;
      }
      const existingTimestamp = new Date(existing.attributes.date_updated);
      const incomingTimeStamp = new Date(object.attributes.date_updated);
      if (incomingTimeStamp > existingTimestamp) {
        existing.update(object);
        return true;
      }
      return false;
    },
    updateOrCreateUser(object: IUserJsonApi) {
      const existing = self.usersArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.usersArray.push(object);
        return true;
      }
      const existingTimestamp = new Date(existing.attributes.date_updated);
      const incomingTimeStamp = new Date(object.attributes.date_updated);
      if (incomingTimeStamp > existingTimestamp) {
        existing.update(object);
        return true;
      }
      return false;
    },
  }))
  .views(self => ({
    /** `user`'s tag named `name`, when the store holds it. */
    findTag(user: string, name: string) {
      const owner = self.usersArray.find(o => o.attributes.username === user);
      return self.tagsArray.find(
        tag =>
          tag.attributes.name === name &&
          tag.relationships.user.data.id === owner?.id
      );
    },
  }))
  .actions(self => ({
    /**
     * Store each resource by its type: entries, junctions, users, tags.
     * Returns whether the store changed.
     */
    reconcileCollection(collection: ResourceCollection) {
      let changed = false;
      for (const element of collection) {
        if (element.type === 'TextEntry') {
          changed = self.updateOrCreateTextEntry(element) || changed;
        }
      }
      for (const element of collection) {
        if (element.type === 'TagTextEntryThroughModel') {
          changed =
            self.updateOrCreateTagTextEntryThroughModel(element) || changed;
        }
      }
      for (const element of collection) {
        if (element.type === 'User') {
          changed = self.updateOrCreateUser(element) || changed;
        }
      }
      for (const element of collection) {
        if (element.type === 'Tag') {
          changed = self.updateOrCreateTag(element) || changed;
        }
      }
      if (changed) {
        self.storeVersion += 1;
      }
      return changed;
    },
    /**
     * Drop the store's links to tag `tagId` that `collection`, all of the
     * tag's entries with their junctions, no longer has. Returns whether any
     * went.
     */
    pruneTagJunctions(tagId: string, collection: ResourceCollection) {
      const kept = new Set(
        collection.flatMap(element =>
          element.type === 'TagTextEntryThroughModel' ? [element.id] : []
        )
      );
      const stale = self.tagTextEntryThroughModel.filter(
        junction =>
          junction.relationships.tag.data.id === tagId && !kept.has(junction.id)
      );
      for (const junction of stale) {
        destroy(junction);
      }
      if (stale.length > 0) {
        self.storeVersion += 1;
      }
      return stale.length > 0;
    },
  }))
  .actions(self => ({
    /** Sync the user's tags changed since the last tags sync. */
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        self.tagsSyncedAt = Date.now();
        const since = self.tagsSyncedThrough;
        const collection: IncludedResource[] = yield TagHelpers.fetch(
          [],
          user,
          1,
          since
        );
        self.reconcileCollection(collection);
        self.tagsSyncedThrough = syncedThrough(collection, 'Tag', since);
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    /** One sync of tag `tagId`'s entries (see `syncTagEntries`). */
    runTagSync: flow(function* runTagSync(
      user: string,
      tagId: string,
      force: boolean
    ) {
      const tag = self.tagsArray.find(candidate => candidate.id === tagId);
      if (tag === undefined) {
        return false;
      }
      const revision = tag.attributes.date_updated;
      const cursor = self.tagSyncCursors.get(tagId);
      if (!force && cursor?.tag === revision) {
        return false;
      }
      const since = cursor?.entries ?? null;
      const changes: IncludedResource[] = yield TextEntryHelpers.fetch(
        [],
        user,
        tagId,
        1,
        since,
        null
      );
      let changed = self.reconcileCollection(changes);
      let entries = syncedThrough(changes, 'TextEntry', since);

      // Changes list no entry that left the tag. More entries linked to it
      // here than it counts means some did: read the tag whole, and drop the
      // links it no longer has.
      const linked = self.tagTextEntryThroughModel.filter(
        junction => junction.relationships.tag.data.id === tagId
      ).length;
      const counted = self.tagsArray.find(candidate => candidate.id === tagId)
        ?.attributes.entry_count;
      if (counted !== undefined && linked > counted) {
        const all: IncludedResource[] = yield TextEntryHelpers.fetch(
          [],
          user,
          tagId,
          1,
          null,
          null
        );
        changed = self.reconcileCollection(all) || changed;
        changed = self.pruneTagJunctions(tagId, all) || changed;
        entries = syncedThrough(all, 'TextEntry', entries);
      }

      // The revision read before the requests: one the tag reached while
      // they ran may cover changes they missed, so it is synced next time.
      self.tagSyncCursors.set(tagId, {tag: revision, entries});
      return changed;
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
        const collection: ResourceCollection = yield TextEntryHelpers.fetch(
          [],
          user,
          null,
          1,
          mostRecentTimestamp,
          0
        );
        for (const element of collection) {
          if (element.type === 'TextEntry') {
            self.updateOrCreateUntaggedTextEntry(element);
          }
        }
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
    setIsStaff(isStaff: boolean) {
      self.isStaff = isStaff;
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
      const existingEntry = self.textEntriesArray.find(
        entry => entry.id === id
      );
      if (existingEntry) {
        destroy(existingEntry);
      }
    },
    removeUser(id: string) {
      const existingUser = self.usersArray.find(user => user.id === id);
      if (existingUser) {
        destroy(existingUser);
      }
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
  }))
  .actions(self => {
    /** Each tag's latest sync, by tag id: a tag's syncs run one at a time. */
    const tagSyncs = new Map<string, Promise<boolean>>();
    return {
      /**
       * Sync the entries of `user`'s tag `name` into the store, and return
       * whether this sync changed it. The API advances a tag's revision
       * whenever one of its entries changes, joins or leaves it, so nothing
       * is requested while the tag's revision is the one it was last synced
       * at (unless `force`: after a write of the app's own that the store
       * does not reflect, such as a reorder). Otherwise only the entries
       * changed since the last sync are read. The tag's revision comes from
       * the tags sync (`fetchTags`).
       */
      syncTagEntries(user: string, name: string, force = false) {
        const tag = self.findTag(user, name);
        if (tag === undefined) {
          return Promise.resolve(false);
        }
        const tagId = tag.id;
        // After the tag's sync in flight, whose failure its caller handles:
        // this one then starts from the cursor that one left.
        const sync = (tagSyncs.get(tagId) ?? Promise.resolve(false))
          .catch(() => false)
          .then(() => self.runTagSync(user, tagId, force));
        tagSyncs.set(tagId, sync);
        const settled = () => {
          if (tagSyncs.get(tagId) === sync) {
            tagSyncs.delete(tagId);
          }
        };
        sync.then(settled, settled);
        return sync;
      },
    };
  });
