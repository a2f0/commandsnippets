import type {IncludedResource} from '@commandsnippets/api-shared';
import {destroy, flow, type Instance, types} from 'mobx-state-tree';
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
  // Null: synced through `entries` but at no revision, so synced again.
  tag: types.maybeNull(types.string),
  entries: types.maybeNull(types.string),
});

/** An entry as a collection to reconcile lists it. */
type ListedEntry = Extract<ResourceCollection[number], {type: 'TextEntry'}>;

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
    // Advances whenever a response changes the store (reconcileCollection,
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
     * Store each resource by its type: entries, junctions, users, tags; and
     * drop the links of each entry whose `text_entry_to_tag` (all of its
     * junctions) no longer lists them, unless the store holds a newer
     * revision of the entry. An entry listed twice (pages read while it
     * changed) counts as its newest copy. Returns whether the store changed.
     */
    reconcileCollection(collection: ResourceCollection) {
      let changed = false;
      // The newest copy of each entry listed (revisions compare as strings,
      // see lib/revisions.ts).
      const entries = new Map<string, ListedEntry>();
      for (const element of collection) {
        if (element.type === 'TextEntry') {
          const other = entries.get(element.id);
          if (
            other === undefined ||
            element.attributes.date_updated > other.attributes.date_updated
          ) {
            entries.set(element.id, element);
          }
        }
      }
      // Entries the store holds a newer revision of, whose links here are
      // older news (the newer response stored or removed them already); and
      // each other entry's links, where its copy lists them all.
      const outdated = new Set<string>();
      const linked = new Map<string, Set<string>>();
      for (const entry of entries.values()) {
        const stored = self.textEntriesArray.find(o => o.id === entry.id);
        if (
          stored !== undefined &&
          stored.attributes.date_updated > entry.attributes.date_updated
        ) {
          outdated.add(entry.id);
          continue;
        }
        changed = self.updateOrCreateTextEntry(entry) || changed;
        if ('text_entry_to_tag' in entry.relationships) {
          linked.set(
            entry.id,
            new Set(
              entry.relationships.text_entry_to_tag.data.map(({id}) => id)
            )
          );
        }
      }
      for (const element of collection) {
        if (element.type !== 'TagTextEntryThroughModel') {
          continue;
        }
        const entryId = element.relationships.text_entry.data.id;
        if (
          linked.get(entryId)?.has(element.id) === false ||
          (outdated.has(entryId) &&
            !self.tagTextEntryThroughModel.some(o => o.id === element.id))
        ) {
          continue;
        }
        changed =
          self.updateOrCreateTagTextEntryThroughModel(element) || changed;
      }
      const unlinked = self.tagTextEntryThroughModel.filter(junction => {
        const junctions = linked.get(junction.relationships.text_entry.data.id);
        return junctions !== undefined && !junctions.has(junction.id);
      });
      for (const junction of unlinked) {
        destroy(junction);
        changed = true;
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
     * Drop the store's links to tag `tagId` that `collection`, the tag's
     * entries read whole, no longer has, of entries it does not list (those
     * it lists had theirs reconciled). A link is gone when the store held it
     * before the read was asked for, or holds its entry at a revision no
     * newer than the newest the read lists; otherwise it may be newer than
     * the read, and stays in doubt. Returns whether any went, and whether
     * any stayed in doubt.
     */
    pruneTagJunctions(
      tagId: string,
      collection: readonly IncludedResource[],
      held: ReadonlySet<string>
    ) {
      const read = new Set(
        collection.flatMap(element =>
          element.type === 'TextEntry' ? [element.id] : []
        )
      );
      const newest = syncedThrough(collection, 'TextEntry', null);
      const stale: Array<Instance<typeof TagTextEntryThroughModel>> = [];
      let doubtful = false;
      for (const junction of self.tagTextEntryThroughModel) {
        const entryId = junction.relationships.text_entry.data.id;
        if (junction.relationships.tag.data.id !== tagId || read.has(entryId)) {
          continue;
        }
        const entry = self.textEntriesArray.find(o => o.id === entryId);
        if (
          held.has(junction.id) ||
          (newest !== null &&
            entry !== undefined &&
            entry.attributes.date_updated <= newest)
        ) {
          stale.push(junction);
        } else {
          doubtful = true;
        }
      }
      for (const junction of stale) {
        destroy(junction);
      }
      if (stale.length > 0) {
        self.storeVersion += 1;
      }
      return {pruned: stale.length > 0, doubtful};
    },
  }))
  .actions(self => ({
    /** Sync the user's tags changed since the last tags sync. */
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        self.tagsSyncedAt = Date.now();
        const since = self.tagsSyncedThrough;
        const collection: IncludedResource[] = yield TagHelpers.fetch(
          user,
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
      // The first time, the tag's entries whole (dropping the links to it
      // they do not have); after that, every entry changed since, whatever
      // its tags are now: an entry that left the tag changed too (untagging
      // advances it), and each lists all of its junctions.
      const since = cursor?.entries ?? null;
      const held = new Set(
        self.tagTextEntryThroughModel.map(junction => junction.id)
      );
      const changes: IncludedResource[] = yield TextEntryHelpers.fetch(
        user,
        since === null ? tagId : null,
        since,
        null
      );
      let changed = self.reconcileCollection(changes);
      let doubtful = false;
      if (since === null) {
        const pruned = self.pruneTagJunctions(tagId, changes, held);
        changed = pruned.pruned || changed;
        doubtful = pruned.doubtful;
      }
      const entries = syncedThrough(changes, 'TextEntry', since);

      // The revision read before the request: one the tag reached while it
      // ran may cover changes it missed, so it is synced next time. A link
      // left in doubt has the tag synced next time too: from `entries`, which
      // then lists its entry, changed since.
      self.tagSyncCursors.set(tagId, {
        tag: doubtful ? null : revision,
        entries,
      });
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
          user,
          null,
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
