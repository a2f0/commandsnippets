import type {
  TextEntry,
  TextEntryReused,
  TextEntryReusedListDocument,
} from '@commandsnippets/api-shared/responses';
import {useEffect, useRef, useState} from 'react';
import {useInfiniteScroll} from '../../hooks/useInfiniteScroll';
import {isLocalId} from '../../lib/sync/outbox';
import type {SyncSession} from '../../lib/sync/session';

/** The history read so far: its reuses, newest first, and their entries. */
export interface HistoryPage {
  reuses: TextEntryReused[];
  entries: TextEntry[];
  page: number;
  total: number;
  more: boolean;
}

/** `items` by id, the later of two with the same id in place of the first. */
const byId = <T extends {id: string}>(items: Iterable<T>) => {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
};

/**
 * The history once `page` of it is read: page 1 starts it afresh, a later
 * page adds to what was read, once each (copies made meanwhile shift the
 * numbered pages, so a page can repeat rows). Deleted entries are left out.
 */
export function mergeHistoryPage(
  previous: HistoryPage | null,
  page: number,
  result: TextEntryReusedListDocument
): HistoryPage {
  const kept = page === 1 ? null : previous;
  const included = (result.included ?? []).filter(
    (resource): resource is TextEntry =>
      resource.type === 'TextEntry' && !resource.attributes.is_deleted
  );
  return {
    reuses: [...byId([...(kept?.reuses ?? []), ...result.data]).values()],
    entries: [...byId([...(kept?.entries ?? []), ...included]).values()],
    page,
    total: result.meta.pagination.count,
    more: result.links.next !== null && result.data.length > 0,
  };
}

/**
 * Reads an entry's reuse history (or the profile's, with no entry) a page
 * at a time, one read at a time: page 1 at first, whenever `count` changes
 * and on reconnecting, and the next page when the end of the list comes
 * into view (`loadMoreTarget`) or is asked for (`readPage`).
 */
export function useReuseHistory(
  session: SyncSession,
  entryId: string | undefined,
  count: number | undefined
) {
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failedPage, setFailedPage] = useState(1);
  const running = useRef(false);
  const refreshPending = useRef(false);
  const readPage = useRef<(page: number) => void>(() => {});
  const unsent = entryId !== undefined && isLocalId(entryId);
  const nextPage = history?.more ? history.page + 1 : null;

  useEffect(() => {
    if (unsent || session.readOnly) return undefined;
    let current = true;
    const read = (page: number) => {
      if (running.current) {
        // A changed count waits for the in-flight read, then refreshes once.
        if (page === 1) refreshPending.current = true;
        return;
      }
      running.current = true;
      setLoading(true);
      setFailed(false);
      session.sync
        .entryReuses(entryId, page)
        .then(result => {
          if (current && result !== null)
            setHistory(previous => mergeHistoryPage(previous, page, result));
        })
        .catch((error: unknown) => {
          console.warn('WARNING: the reuses could not be read:', error);
          if (current) {
            setFailed(true);
            setFailedPage(page);
          }
        })
        .finally(() => {
          running.current = false;
          if (current) setLoading(false);
          if (refreshPending.current) {
            refreshPending.current = false;
            readPage.current(1);
          }
        });
    };
    readPage.current = read;
    const refresh = () => read(1);
    refresh();
    window.addEventListener('online', refresh);
    return () => {
      current = false;
      readPage.current = () => {};
      window.removeEventListener('online', refresh);
    };
  }, [session, entryId, count, unsent]);

  const loadMoreTarget = useInfiniteScroll(
    () => {
      if (nextPage !== null) readPage.current(nextPage);
    },
    nextPage !== null && !loading && !failed && !unsent && !session.readOnly
  );

  return {
    history,
    failed,
    loading,
    failedPage,
    readPage,
    unsent,
    nextPage,
    loadMoreTarget,
  };
}
