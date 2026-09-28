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
  logEntry: string;
  logEntry_plural: string;
  errorCaptured: string;
  errorCaptured_plural: string;
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
  populateIndexedDB: string;
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

export interface AdminTranslations {
  title: string;
  menuLink: string;
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
  never: string;
  deactivate: string;
  reactivate: string;
  deactivateTitle: string;
  deactivateBody: string;
  reactivateTitle: string;
  reactivateBody: string;
  cannotDeactivateSelf: string;
  updateError: string;
  noUsers: string;
  noAuditEntries: string;
  actionDeactivateUser: string;
  actionActivateUser: string;
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

// Helper types for keys
export type CommonKeys = keyof CommonTranslations;
export type MenuKeys = keyof MenuTranslations;
export type TagsKeys = keyof TagsTranslations;
export type EntriesKeys = keyof EntriesTranslations;
export type AdminKeys = keyof AdminTranslations;

export type NamespaceKeys = keyof Translations;

export type TranslationKeys<NS extends NamespaceKeys> = keyof Translations[NS];
