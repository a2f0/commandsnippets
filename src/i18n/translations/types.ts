// Translation type definitions
export interface CommonTranslations {
  welcome: string;
  logout: string;
  login: string;
  save: string;
  cancel: string;
  delete: string;
  edit: string;
  search: string;
  loading: string;
  error: string;
  success: string;
  confirm: string;
  yes: string;
  no: string;
  language: string;
  languageName: string;
  settings: string;
}

export interface MenuTranslations {
  file: string;
  view: string;
  help: string;
  tags: string;
  entries: string;
  allEntries: string;
  untaggedEntries: string;
  about: string;
  debug: string;
  newTag: string;
  newEntry: string;
  hud: string;
  performance: string;
  logs: string;
  analytics: string;
  performanceMetrics: string;
  applicationLogs: string;
  analyticsData: string;
  openHudMenu: string;
}

export interface TagsTranslations {
  tagName: string;
  createTag: string;
  editTag: string;
  deleteTag: string;
  confirmDeleteTag: string;
  tagCreated: string;
  tagUpdated: string;
  tagDeleted: string;
  noTags: string;
  tagCount: string;
  tagCount_plural: string;
}

export interface EntriesTranslations {
  entryTitle: string;
  entryContent: string;
  createEntry: string;
  editEntry: string;
  deleteEntry: string;
  confirmDeleteEntry: string;
  entryCreated: string;
  entryUpdated: string;
  entryDeleted: string;
  noEntries: string;
  entryCount: string;
  entryCount_plural: string;
}

export interface Translations {
  common: CommonTranslations;
  menu: MenuTranslations;
  tags: TagsTranslations;
  entries: EntriesTranslations;
}

export type I18NextTranslations = {
  common: CommonTranslations;
  menu: MenuTranslations;
  tags: TagsTranslations;
  entries: EntriesTranslations;
} & Record<string, Record<string, string>>;

// Helper types for keys
export type CommonKeys = keyof CommonTranslations;
export type MenuKeys = keyof MenuTranslations;
export type TagsKeys = keyof TagsTranslations;
export type EntriesKeys = keyof EntriesTranslations;

export type NamespaceKeys = keyof Translations;

export type TranslationKeys<NS extends NamespaceKeys> = keyof Translations[NS];
