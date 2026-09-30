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
  selectLanguage: string;
  settings: string;
  logoAlt: string;
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
  aboutDialogTitle: string;
  appVersion: string;
  apiVersion: string;
  versionUnknown: string;
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
  expandHud: string;
  collapseHud: string;
  details: string;
  noLogsAvailable: string;
  logEntry_one: string;
  logEntry_other: string;
  errorCaptured_one: string;
  errorCaptured_other: string;
  cpuUsage: string;
  memory: string;
  network: string;
  activeUsers: string;
  totalSessions: string;
  avgSessionDuration: string;
  darkMode: string;
  lightMode: string;
  showTagCounts: string;
  sortByBody: string;
  sortByDateCreated: string;
  sortByDateTagged: string;
  sortBySubject: string;
  sortByTagCount: string;
  sortByUserDefinedOrder: string;
  sortByTagName: string;
  sortByDateLastUsed: string;
  sortByEntryCount: string;
  triggerTestError: string;
  syncIndexedDB: string;
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
  tagCount_one: string;
  tagCount_other: string;
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
  entryCount_one: string;
  entryCount_other: string;
}

export interface AdminTranslations {
  title: string;
  modeLabel: string;
  userMode: string;
  adminMode: string;
  usersTab: string;
  auditLogTab: string;
  forbidden: string;
  loadError: string;
  retry: string;
  searchLabel: string;
  statusLabel: string;
  statusAll: string;
  statusActive: string;
  statusInactive: string;
  columnUsername: string;
  columnEmail: string;
  columnJoined: string;
  columnLastLogin: string;
  columnLastActive: string;
  columnLogins: string;
  columnEntries: string;
  columnTags: string;
  columnStatus: string;
  columnWhen: string;
  columnAction: string;
  columnBy: string;
  columnUser: string;
  staff: string;
  active: string;
  inactive: string;
  markedForDeletion: string;
  never: string;
  userActions: string;
  viewData: string;
  readOnlyBadge: string;
  readOnlyTooltip: string;
  deactivate: string;
  reactivate: string;
  deactivateTitle: string;
  deactivateBody: string;
  reactivateTitle: string;
  reactivateBody: string;
  markForDeletion: string;
  markForDeletionTitle: string;
  markForDeletionBody: string;
  unmarkForDeletion: string;
  unmarkForDeletionTitle: string;
  unmarkForDeletionBody: string;
  cannotChangeSelf: string;
  updateError: string;
  noUsers: string;
  noAuditEntries: string;
  actionDeactivateUser: string;
  actionActivateUser: string;
  actionMarkUserForDeletion: string;
  actionUnmarkUserForDeletion: string;
  rowsPerPage: string;
  displayedRows: string;
}

export interface Translations {
  common: CommonTranslations;
  menu: MenuTranslations;
  tags: TagsTranslations;
  entries: EntriesTranslations;
  admin: AdminTranslations;
}

export type I18NextTranslations = {
  common: CommonTranslations;
  menu: MenuTranslations;
  tags: TagsTranslations;
  entries: EntriesTranslations;
  admin: AdminTranslations;
} & Record<string, Record<string, string>>;

export type NamespaceKeys = keyof Translations;

/**
 * i18next's plural suffixes, one key per plural form of the language
 * (https://www.i18next.com/translation-function/plurals): `tagCount_one` and
 * `tagCount_other` in English. i18next no longer reads the old `_plural`
 * suffix (its v3 JSON format).
 */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/** The key `t()` takes for a translation key: a plural key without its suffix. */
type TranslationKey<Key> = Key extends `${infer Base}_${PluralSuffix}`
  ? Base
  : Key;

/**
 * The keys `t()` takes in a namespace. Pass a plural key (`tagCount`) with a
 * `count`, and i18next picks the form: `t('tagCount', {count: 2})`.
 */
export type TranslationKeys<NS extends NamespaceKeys> = TranslationKey<
  keyof Translations[NS]
>;

// Helper types for keys
export type CommonKeys = TranslationKeys<'common'>;
export type MenuKeys = TranslationKeys<'menu'>;
export type TagsKeys = TranslationKeys<'tags'>;
export type EntriesKeys = TranslationKeys<'entries'>;
export type AdminKeys = TranslationKeys<'admin'>;
