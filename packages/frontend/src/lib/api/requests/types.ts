// The collections' query parameters as the client sends them. The request
// documents are api-shared's (`TagCreateDocument`, `TextEntryUpdateDocument`,
// ...).

export interface EntriesQueryParams {
  'page[number]'?: number;
  'filter[user.username]'?: string;
  'filter[tags.name]'?: string;
  'filter[date_updated.gt]'?: string;
  'filter[untagged]'?: boolean;
  'filter[term]'?: string;
  'filter[tag_count]'?: number;
  'filter[search]'?: string;
  sort?: string;
  include?: string;
}

export interface TagsQueryParams {
  'page[number]': number;
  'filter[user.username]': string;
  sort: string;
  'filter[date_updated.gt]'?: string;
}

export interface IEntryFetchPage {
  page: number;
  username: string;
  sort: string;
  search?: string;
  signal: AbortSignal;
}
