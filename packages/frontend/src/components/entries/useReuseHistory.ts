import type {
  TextEntry,
  TextEntryReused,
  TextEntryReusedListDocument,
} from '@commandsnippets/api-shared/responses';
import {useCallback, useEffect, useRef, useState} from 'react';
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
 * Where reading the history is: `waiting` before the first read (and after
 * a superseded read with none to follow), `reading` one page (`current`
 * false once the reader that asked for it is gone: its result is dropped;
 * `refresh`: page 1 is read again after it), `read`, or `failed` at `page`.
 */
export type ReuseRead =
  | {status: 'waiting'}
  | {
      status: 'reading';
      page: number;
      request: number;
      current: boolean;
      refresh: boolean;
    }
  | {status: 'read'}
  | {status: 'failed'; page: number};

export interface ReuseHistoryState {
  read: ReuseRead;
  history: HistoryPage | null;
  /** The last request number handed out. */
  requests: number;
}

export type ReuseHistoryEvent =
  /** A page is asked for: page 1 asked for during a read follows it. */
  | {type: 'read'; page: number}
  /** The reader that asked for the read in flight is gone. */
  | {type: 'detach'}
  | {
      type: 'succeed';
      request: number;
      result: TextEntryReusedListDocument | null;
    }
  | {type: 'fail'; request: number};

export const INITIAL_REUSE_HISTORY: ReuseHistoryState = {
  read: {status: 'waiting'},
  history: null,
  requests: 0,
};

const reading = (state: ReuseHistoryState, page: number) => ({
  ...state,
  read: {
    status: 'reading' as const,
    page,
    request: state.requests + 1,
    current: true,
    refresh: false,
  },
  requests: state.requests + 1,
});

type Reading = Extract<ReuseRead, {status: 'reading'}>;

/**
 * The read in flight, `request`, finished: page 1 next if a refresh is
 * queued, else `outcome` for a current read, or back to waiting for a
 * superseded one. Any other request's result is ignored.
 */
const finished = (
  state: ReuseHistoryState,
  request: number,
  outcome: (read: Reading) => ReuseHistoryState
): ReuseHistoryState => {
  const {read} = state;
  if (read.status !== 'reading' || read.request !== request) return state;
  const next = read.current
    ? outcome(read)
    : {...state, read: {status: 'waiting' as const}};
  return read.refresh ? reading(next, 1) : next;
};

/** The history after `event`: one read at a time, only its own result kept. */
export function transitionReuseHistory(
  state: ReuseHistoryState,
  event: ReuseHistoryEvent
): ReuseHistoryState {
  const {read} = state;
  switch (event.type) {
    case 'read':
      if (read.status !== 'reading') return reading(state, event.page);
      // A changed count waits for the read in flight, then refreshes once.
      return event.page === 1 && !read.refresh
        ? {...state, read: {...read, refresh: true}}
        : state;
    case 'detach':
      return read.status === 'reading' && read.current
        ? {...state, read: {...read, current: false}}
        : state;
    case 'succeed':
      return finished(state, event.request, ({page}) => ({
        ...state,
        read: {status: 'read'},
        history:
          event.result === null
            ? state.history
            : mergeHistoryPage(state.history, page, event.result),
      }));
    case 'fail':
      return finished(state, event.request, ({page}) => ({
        ...state,
        read: {status: 'failed', page},
      }));
    default:
      return assertNever(event);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled reuse history event: ${JSON.stringify(value)}`);
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
  // The machine's state, read synchronously by the events, and its copy
  // for rendering; `send` is the only writer of both.
  const machine = useRef(INITIAL_REUSE_HISTORY);
  const [state, setState] = useState(INITIAL_REUSE_HISTORY);
  // Starts a read with the current reader's session and entry.
  const launch = useRef<((page: number, request: number) => void) | null>(null);
  const send = useCallback((event: ReuseHistoryEvent) => {
    const previous = machine.current;
    const next = transitionReuseHistory(previous, event);
    if (next === previous) return;
    machine.current = next;
    setState(next);
    const {read} = next;
    if (
      read.status === 'reading' &&
      (previous.read.status !== 'reading' ||
        previous.read.request !== read.request)
    )
      launch.current?.(read.page, read.request);
  }, []);
  const readPage = useRef<(page: number) => void>(() => {});
  const unsent = entryId !== undefined && isLocalId(entryId);
  const {history, read} = state;
  const loading = read.status === 'waiting' || read.status === 'reading';
  const failed = read.status === 'failed';
  const nextPage = history?.more ? history.page + 1 : null;

  useEffect(() => {
    if (unsent || session.readOnly) return undefined;
    launch.current = (page, request) => {
      session.sync
        .entryReuses(entryId, page)
        .then(result => send({type: 'succeed', request, result}))
        .catch((error: unknown) => {
          console.warn('WARNING: the reuses could not be read:', error);
          send({type: 'fail', request});
        });
    };
    readPage.current = page => send({type: 'read', page});
    const refresh = () => send({type: 'read', page: 1});
    refresh();
    window.addEventListener('online', refresh);
    return () => {
      launch.current = null;
      readPage.current = () => {};
      window.removeEventListener('online', refresh);
      send({type: 'detach'});
    };
  }, [session, entryId, count, unsent, send]);

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
    failedPage: read.status === 'failed' ? read.page : 1,
    readPage,
    unsent,
    nextPage,
    loadMoreTarget,
  };
}
