/**
 * The tags an entry list shows under its entries: the names of the tags each
 * entry is in, but the one the list shows.
 */
import type {Tag} from '@commandsnippets/api-shared/responses';

/** No tags to show: the same array for every entry that has none. */
export const NO_TAG_NAMES: readonly string[] = [];

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((name, index) => name === b[index]);

/**
 * The names to show under each entry, by entry id: those of the tags it is
 * in (`tagIdsByEntry`), not deleted and not the tag the list shows
 * (`shownTagId`), by name as the entry's page lists them. Entries with none
 * are left out. An entry whose names are unchanged keeps its array from
 * `previous`, so its row (`React.memo`) renders again only when they change.
 */
export function tagNamesByEntry(
  tagIdsByEntry: ReadonlyMap<string, readonly string[]>,
  tags: readonly Tag[],
  shownTagId: string | undefined,
  previous: ReadonlyMap<string, readonly string[]>
): Map<string, readonly string[]> {
  const nameOf = new Map<string, string>();
  for (const tag of tags) {
    if (!tag.attributes.is_deleted && tag.id !== shownTagId) {
      nameOf.set(tag.id, tag.attributes.name);
    }
  }
  const byEntry = new Map<string, readonly string[]>();
  for (const [entryId, tagIds] of tagIdsByEntry) {
    const names = tagIds
      .flatMap(tagId => nameOf.get(tagId) ?? [])
      .sort((a, b) => a.localeCompare(b));
    if (names.length > 0) {
      const before = previous.get(entryId);
      byEntry.set(
        entryId,
        before !== undefined && sameNames(before, names) ? before : names
      );
    }
  }
  return byEntry;
}
