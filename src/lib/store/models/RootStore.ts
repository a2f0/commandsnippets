import {flow, types} from 'mobx-state-tree';
import type {DataRepository} from '../repository/DataRepository';
import type {ITagJsonApi} from './TagModel';
import type {ITagTextEntryThroughModelJsonApi} from './TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from './TextEntryModel';
import {UIStateModel} from './UIStateModel';
import type {IUserJsonApi} from './UserModel';

// This is the new root store that combines UI state with repository-managed data
export const RootStore = types
  .model('RootStore', {
    uiState: UIStateModel,
  })
  .volatile<{
    repository: DataRepository | null;
    // Cached data from repository for fast access
    tagsCache: ITagJsonApi[];
    textEntriesCache: ITextEntryJsonApi[];
    untaggedTextEntriesCache: ITextEntryJsonApi[];
    tagTextEntryRelationsCache: ITagTextEntryThroughModelJsonApi[];
    usersCache: IUserJsonApi[];
  }>(() => ({
    repository: null,
    tagsCache: [],
    textEntriesCache: [],
    untaggedTextEntriesCache: [],
    tagTextEntryRelationsCache: [],
    usersCache: [],
  }))
  .views(self => ({
    // Computed views for accessing cached data
    get tags() {
      return self.tagsCache;
    },

    get textEntries() {
      return self.textEntriesCache;
    },

    get untaggedTextEntries() {
      return self.untaggedTextEntriesCache;
    },

    get tagTextEntryRelations() {
      return self.tagTextEntryRelationsCache;
    },

    get users() {
      return self.usersCache;
    },

    // Helper views
    get currentUserObject() {
      if (!self.uiState.currentUser) return null;
      return (
        self.usersCache.find(
          u => u.attributes.username === self.uiState.currentUser
        ) || null
      );
    },

    get currentTagObject() {
      if (!self.uiState.currentTag) return null;
      const currentUser = self.uiState.currentUser;
      if (!currentUser) return null;
      const userObj = self.usersCache.find(
        u => u.attributes.username === currentUser
      );
      if (!userObj) return null;
      return (
        self.tagsCache.find(
          t =>
            t.attributes.name === self.uiState.currentTag &&
            t.relationships.user.data.id === userObj.id
        ) || null
      );
    },

    getTagsByUser(userId: string) {
      return self.tagsCache.filter(
        tag => tag.relationships.user.data.id === userId
      );
    },

    getTextEntriesByTag(tagId: string) {
      const relationIds = self.tagTextEntryRelationsCache
        .filter(r => r.relationships.tag.data.id === tagId)
        .map(r => r.relationships.text_entry.data.id);

      return self.textEntriesCache.filter(entry =>
        relationIds.includes(entry.id)
      );
    },

    getTextEntriesByUser(userId: string) {
      return self.textEntriesCache.filter(
        entry => entry.relationships.user.data.id === userId
      );
    },

    getUntaggedTextEntriesByUser(userId: string) {
      return self.untaggedTextEntriesCache.filter(
        entry => entry.relationships.user.data.id === userId
      );
    },
  }))
  .actions(self => ({
    setRepository(repository: DataRepository) {
      self.repository = repository;
    },

    // Cache update actions
    updateTagsCache(tags: ITagJsonApi[]) {
      self.tagsCache = tags;
    },

    updateTextEntriesCache(entries: ITextEntryJsonApi[]) {
      self.textEntriesCache = entries;
    },

    updateUntaggedTextEntriesCache(entries: ITextEntryJsonApi[]) {
      self.untaggedTextEntriesCache = entries;
    },

    updateTagTextEntryRelationsCache(
      relations: ITagTextEntryThroughModelJsonApi[]
    ) {
      self.tagTextEntryRelationsCache = relations;
    },

    updateUsersCache(users: IUserJsonApi[]) {
      self.usersCache = users;
    },

    // Load data from repository into cache
    loadFromRepository: flow(function* () {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      try {
        self.uiState.setSyncStatus(true);

        // Load all data from repository
        const [tags, textEntries, untaggedTextEntries, relations, users] =
          yield Promise.all([
            self.repository.getTags(),
            self.repository.getTextEntries(),
            self.repository.getUntaggedTextEntries(),
            self.repository.getTagTextEntryRelations(),
            self.repository.getUsers(),
          ]);

        // Update caches
        self.tagsCache = tags;
        self.textEntriesCache = textEntries;
        self.untaggedTextEntriesCache = untaggedTextEntries;
        self.tagTextEntryRelationsCache = relations;
        self.usersCache = users;

        self.uiState.setSyncStatus(false);
      } catch (error) {
        console.error('Failed to load from repository:', error);
        self.uiState.setSyncStatus(false, (error as Error).message);
        throw error;
      }
    }),
  }))
  .actions(self => ({
    // Data operations that go through repository
    fetchTags: flow(function* (username: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      try {
        self.uiState.setSyncStatus(true);
        yield self.repository.syncTags(username);

        // Reload tags from repository
        const tags = yield self.repository.getTags();
        self.updateTagsCache(tags);

        self.uiState.setSyncStatus(false);
      } catch (error) {
        console.error('Failed to fetch tags:', error);
        self.uiState.setSyncStatus(false, (error as Error).message);
        throw error;
      }
    }),

    fetchTextEntries: flow(function* (username: string, tagName: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      try {
        self.uiState.setSyncStatus(true);
        yield self.repository.syncTextEntries(username, tagName);

        // Reload data from repository
        const [textEntries, relations] = yield Promise.all([
          self.repository.getTextEntries(),
          self.repository.getTagTextEntryRelations(),
        ]);

        self.updateTextEntriesCache(textEntries);
        self.updateTagTextEntryRelationsCache(relations);

        self.uiState.setSyncStatus(false);
      } catch (error) {
        console.error('Failed to fetch text entries:', error);
        self.uiState.setSyncStatus(false, (error as Error).message);
        throw error;
      }
    }),

    fetchUntaggedTextEntries: flow(function* (username: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      try {
        self.uiState.setSyncStatus(true);
        yield self.repository.syncUntaggedTextEntries(username);

        // Reload untagged entries from repository
        const untaggedEntries = yield self.repository.getUntaggedTextEntries();
        self.updateUntaggedTextEntriesCache(untaggedEntries);

        self.uiState.setSyncStatus(false);
      } catch (error) {
        console.error('Failed to fetch untagged text entries:', error);
        self.uiState.setSyncStatus(false, (error as Error).message);
        throw error;
      }
    }),

    // Local data operations
    addTag: flow(function* (tag: ITagJsonApi) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.saveTag(tag);
      const tags = yield self.repository.getTags();
      self.updateTagsCache(tags);
    }),

    removeTag: flow(function* (id: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.deleteTag(id);
      const tags = yield self.repository.getTags();
      self.updateTagsCache(tags);
    }),

    addTextEntry: flow(function* (entry: ITextEntryJsonApi) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.saveTextEntry(entry);
      const entries = yield self.repository.getTextEntries();
      self.updateTextEntriesCache(entries);
    }),

    removeTextEntry: flow(function* (id: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.deleteTextEntry(id);
      const entries = yield self.repository.getTextEntries();
      self.updateTextEntriesCache(entries);
    }),

    addUntaggedTextEntry: flow(function* (entry: ITextEntryJsonApi) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.saveUntaggedTextEntry(entry);
      const entries = yield self.repository.getUntaggedTextEntries();
      self.updateUntaggedTextEntriesCache(entries);
    }),

    removeUntaggedTextEntry: flow(function* (id: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.deleteUntaggedTextEntry(id);
      const entries = yield self.repository.getUntaggedTextEntries();
      self.updateUntaggedTextEntriesCache(entries);
    }),

    addTagTextEntryRelation: flow(function* (
      relation: ITagTextEntryThroughModelJsonApi
    ) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.saveTagTextEntryRelation(relation);
      const relations = yield self.repository.getTagTextEntryRelations();
      self.updateTagTextEntryRelationsCache(relations);
    }),

    removeTagTextEntryRelation: flow(function* (id: string) {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.deleteTagTextEntryRelation(id);
      const relations = yield self.repository.getTagTextEntryRelations();
      self.updateTagTextEntryRelationsCache(relations);
    }),

    // Utility actions
    clearAll: flow(function* () {
      if (!self.repository) {
        throw new Error('Repository not initialized');
      }

      yield self.repository.clearAll();

      // Clear caches
      self.tagsCache = [];
      self.textEntriesCache = [];
      self.untaggedTextEntriesCache = [];
      self.tagTextEntryRelationsCache = [];
      self.usersCache = [];
    }),
  }));
