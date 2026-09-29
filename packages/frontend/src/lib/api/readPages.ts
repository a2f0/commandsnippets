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
 * Every page of a list sorted by revision (`date_updated`): its resources
 * and those included with them, in order. The pages are offsets, read one
 * request at a time, so rows that change in between shift: a row that
 * changes moves to the end, and the row across the next page boundary is
 * skipped. A row read twice, or a total that differs from one page to the
 * next, shows that where rows only ever join a list at its end (a list of
 * what changed since a revision). Where rows also leave it, one leaving and
 * another joining shift it with neither sign: `revisionOf` then reads a
 * revision the server advances whenever the list changes from each page, and
 * a page with a different one than the page before shows it. The list is
 * then read again from its first page; after ATTEMPTS such reads it fails,
 * so a sync never takes a list with a row missing (its caller keeps its
 * cursor and syncs again later).
 */
export async function readPages(
  readPage: (page: number) => Promise<ListPage>,
  revisionOf: (page: ListPage) => string | undefined = () => undefined
): Promise<IncludedResource[]> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const resources: IncludedResource[] = [];
    const read = new Set<string>();
    let total: number | undefined;
    let revision: string | undefined;
    let shifted = false;
    for (let page = 1; !shifted; page++) {
      const response = await readPage(page);
      const {count} = response.meta.pagination;
      const current = revisionOf(response);
      shifted =
        (total !== undefined && count !== total) ||
        (revision !== undefined &&
          current !== undefined &&
          current !== revision);
      total = count;
      revision = current ?? revision;
      for (const resource of response.data) {
        shifted ||= read.has(resource.id);
        read.add(resource.id);
        resources.push(resource);
      }
      resources.push(...(response.included ?? []));
      if (response.links.next === null) {
        break;
      }
    }
    if (!shifted) {
      return resources;
    }
  }
  throw new Error('The list changed on every read of its pages');
}
