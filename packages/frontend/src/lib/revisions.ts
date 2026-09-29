import type {IncludedResource} from '@commandsnippets/api-shared';

/**
 * The newest of `revisions` (null when there are none). Revisions are the
 * API's `date_updated` timestamps, all in one format (api-shared's
 * `timestampSchema`: `YYYY-MM-DDTHH:MM:SS`, then `.ffffff` unless it is
 * zero), so they compare as strings: the first 19 characters are fixed-width,
 * and a revision without microseconds is a prefix of, and older than, one of
 * the same second with them.
 */
export function newestRevision(
  revisions: Iterable<string | null>
): string | null {
  let newest: string | null = null;
  for (const revision of revisions) {
    if (revision !== null && (newest === null || revision > newest)) {
      newest = revision;
    }
  }
  return newest;
}

/** The newest revision of the `type` resources in `resources`, or `since`. */
export function syncedThrough(
  resources: readonly IncludedResource[],
  type: 'Tag' | 'TextEntry',
  since: string | null
): string | null {
  return newestRevision([
    since,
    ...resources.flatMap(resource =>
      (resource.type === 'Tag' || resource.type === 'TextEntry') &&
      resource.type === type
        ? [resource.attributes.date_updated]
        : []
    ),
  ]);
}
