import type {
  IncludedResource,
  TagListDocument,
  TextEntryListDocument,
} from '@commandsnippets/api-shared/responses';

/** A page of a list the syncs read. */
type ListPage = TagListDocument | TextEntryListDocument;

/** How many times a list is read before the read fails for changing. */
const ATTEMPTS = 3;

/**
 * A revision the server advances whenever a list changes, which each page
 * includes (loaded after the page's rows): how `readPages` tells that a list
 * whose rows can leave it stayed put while its pages were read.
 */
export interface ListRevision {
  /** The revision read before the list's rows (such as a stored one). */
  before: string;
  /** The revision a page includes, if it does. */
  of: (page: ListPage) => string | undefined;
}

/**
 * Every page of a list sorted by revision (`date_updated`): its resources
 * and those included with them, in order. The pages are offsets, read one
 * request at a time, so rows that change in between shift: a row that
 * changes moves to the end, and the row across the next page boundary is
 * skipped. Where rows only ever join a list at its end (a list of what
 * changed since a revision), a row read twice or a total that differs from
 * one page to the next shows that. Where rows also leave it, one leaving and
 * another joining shift it with neither sign, so a read of more than one
 * page must end with the `revision` it began with: the last page includes
 * it as read after every page's rows (a single page is one query). A list
 * that shifted is read again from its first page (from the revision it
 * ended with); after ATTEMPTS such reads the read fails, so a sync never
 * takes a list with a row missing (its caller keeps its cursor and syncs
 * again later).
 */
export async function readPages(
  readPage: (page: number) => Promise<ListPage>,
  revision?: ListRevision
): Promise<IncludedResource[]> {
  let before = revision?.before;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const resources: IncludedResource[] = [];
    const read = new Set<string>();
    let total: number | undefined;
    let shifted = false;
    let page = 1;
    for (; !shifted; page++) {
      const response = await readPage(page);
      const {count} = response.meta.pagination;
      shifted = total !== undefined && count !== total;
      total = count;
      for (const resource of response.data) {
        shifted ||= read.has(resource.id);
        read.add(resource.id);
        resources.push(resource);
      }
      resources.push(...(response.included ?? []));
      if (response.links.next === null) {
        if (revision !== undefined && page > 1) {
          const after = revision.of(response);
          shifted ||= after === undefined || after !== before;
          before = after ?? before;
        }
        break;
      }
    }
    if (!shifted) {
      return resources;
    }
  }
  throw new Error('The list changed on every read of its pages');
}
