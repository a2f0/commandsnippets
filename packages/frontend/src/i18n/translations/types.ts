export interface AnalyticsTranslations {
  title: string;
  description: string;
  created: string;
  tags_created: string;
  tagged: string;
  reused: string;
  activity: string;
  from: string;
  to: string;
  interval: string;
  day: string;
  week: string;
  month: string;
  tag: string;
  allTags: string;
  last30: string;
  last90: string;
  last365: string;
  refresh: string;
  events: string;
  entries: string;
  tags: string;
  timeline: string;
  topTags: string;
  topEntries: string;
  rankNote: string;
  empty: string;
  loading: string;
  failed: string;
  retry: string;
  invalidRange: string;
  counting: string;
  createdNote: string;
  tags_createdNote: string;
  taggedNote: string;
  reusedNote: string;
  showData: string;
  hideData: string;
  period: string;
  count: string;
  chartDescription_one: string;
  chartDescription_other: string;
  tagCohortNote: string;
  back: string;
  tagFiltered: string;
  partialPeriods: string;
}

// Translation type definitions
export interface CommonTranslations {
  welcome: string;
  logout: string;
  save: string;
  cancel: string;
  delete: string;
  loading: string;
  languageName: string;
  selectLanguage: string;
  logoAlt: string;
  unsentWritesTitle: string;
  unsentWrites_one: string;
  unsentWrites_other: string;
  unsentWritesKept: string;
  signOutKeepingWrites: string;
  discardAndSignOut: string;
  dismiss: string;
  privacyPolicy: string;
  termsOfService: string;
  serviceOperator: string;
}

export interface MenuTranslations {
  file: string;
  view: string;
  help: string;
  tags: string;
  resizeTagSidebar: string;
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
  exportBackup: string;
  exportBackupFailedTitle: string;
  exportBackupFailed: string;
  restoreBackup: string;
  restoreConfirmTitle: string;
  restoreConfirmText: string;
  restoreYourData: string;
  restoreBackupData: string;
  restoreCounts: string;
  restoreConfirm: string;
  restoringTitle: string;
  restoringText: string;
  restoreDoneTitle: string;
  restoreDoneText: string;
  restoreFailedTitle: string;
  restoreFailedText: string;
  restoreInvalidTitle: string;
  restoreInvalidText: string;
  dataVersions: string;
  dataVersionsTitle: string;
  dataVersionsText: string;
  dataVersionName: string;
  dataVersionActive: string;
  dataVersionInitial: string;
  dataVersionRestored: string;
  dataVersionSwitch: string;
  dataVersionExport: string;
  dataVersionDelete: string;
  dataVersionSwitchTitle: string;
  dataVersionSwitchText: string;
  dataVersionSwitchConfirm: string;
  dataVersionDeleteTitle: string;
  dataVersionDeleteText: string;
  dataVersionDeleteConfirm: string;
  dataVersionsLoading: string;
  dataVersionsFailed: string;
  hud: string;
  logs: string;
  analytics: string;
  openHudMenu: string;
  expandHud: string;
  collapseHud: string;
  timingsInteraction: string;
  timingsNoInteractions: string;
  timingsClickToPaint: string;
  timingsNotPainted: string;
  timingsBusy: string;
  timingsCount_one: string;
  timingsCount_other: string;
  timingsBusyNote: string;
  timingsHoverHint: string;
  timingsStartsAt: string;
  timingsPainted: string;
  timingsMore_one: string;
  timingsMore_other: string;
  timingsAll: string;
  timingsWindow: string;
  timingsWindowTenSeconds: string;
  timingsWindowMinute: string;
  timingsWindowFiveMinutes: string;
  timingsWindowAll: string;
  timingsClear: string;
  timingsNone: string;
  timingsKindNetwork: string;
  timingsKindIdb: string;
  timingsKindRender: string;
  timingsColumnKind: string;
  timingsColumnName: string;
  timingsColumnCount: string;
  timingsColumnP50: string;
  timingsColumnP95: string;
  timingsColumnMax: string;
  timingsColumnTotal: string;
  timingsTimeline: string;
  timingsWaterfall: string;
  timingsNow: string;
  details: string;
  noLogsAvailable: string;
  logEntry_one: string;
  logEntry_other: string;
  errorCaptured_one: string;
  errorCaptured_other: string;
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
  createTag: string;
  deleteTag: string;
  confirmDeleteTag: string;
  tagCount_one: string;
  tagCount_other: string;
}

export interface EntriesTranslations {
  loadingEntries: string;
  loadingEntryPage: string;
  entryPagesLoaded: string;
  entryLoadFailed: string;
  retryEntryLoad: string;
  createEntry: string;
  deleteEntry: string;
  entryCount_one: string;
  entryCount_other: string;
  reusedCount_one: string;
  reusedCount_other: string;
  entryInfoTitle: string;
  infoTags: string;
  entryTags: string;
  infoNoTags: string;
  infoVisibility: string;
  infoPublic: string;
  infoPrivate: string;
  infoReused: string;
  infoTimes_one: string;
  infoTimes_other: string;
  infoCreated: string;
  infoUpdated: string;
  infoSize: string;
  infoSizeValue: string;
  infoCharacters_one: string;
  infoCharacters_other: string;
  infoLines_one: string;
  infoLines_other: string;
  infoId: string;
  infoNotSent: string;
  entryBack: string;
  entryLoading: string;
  entryNotFound: string;
  infoBody: string;
  infoCopy: string;
  infoCopied: string;
  allReuses: string;
  backToAnalytics: string;
  backToReuses: string;
  profileReuseHistory: string;
  allReusesDescription: string;
  allReusesEmpty: string;
  reuseRefresh: string;
  reuseShowMore: string;
  reuseTotal_one: string;
  reuseTotal_other: string;
  reuseUnavailableEntry: string;
  reuseHistory: string;
  reuseHistoryLoading: string;
  reuseHistoryEnd: string;
  reuseHistoryEmpty: string;
  reuseHistoryFailed: string;
  reuseHistoryRetry: string;
  reuseHistoryOwnerOnly: string;
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
  analytics: AnalyticsTranslations;
  common: CommonTranslations;
  menu: MenuTranslations;
  tags: TagsTranslations;
  entries: EntriesTranslations;
  admin: AdminTranslations;
}

export type I18NextTranslations = {
  analytics: AnalyticsTranslations;
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
