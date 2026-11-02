/**
 * When a write is made (`made`, the API's `Client-Updated`): the API keeps
 * the newer of two writes to a row whatever order they arrive in (last
 * writer wins), so no write may be made before one queued ahead of it.
 */
import {formatMicros} from '@commandsnippets/api-shared/datetime';
import {type CommandsnippetsDatabase, MADE_KEY} from '../db/database';

/** Where this browser keeps the last time a write was made here. */
export const LAST_MADE_KEY = 'commandsnippets-last-made';

let lastMade = 0;

/**
 * Now, in the API's datetime form: when a write is made. Always later than
 * the last write made in this browser (in any tab, before any reload), so a
 * clock set back never makes a later write older than one queued before it,
 * which the API would then discard (last writer wins).
 */
export function madeNow(): string {
  let stored = 0;
  try {
    stored = Number(globalThis.localStorage?.getItem(LAST_MADE_KEY) ?? 0) || 0;
  } catch {
    // Storage unavailable: this page's own writes still stay in order.
  }
  const micros = Math.max(Date.now() * 1000, Math.max(lastMade, stored) + 1);
  lastMade = micros;
  try {
    globalThis.localStorage?.setItem(LAST_MADE_KEY, String(micros));
  } catch {
    // As above.
  }
  return formatMicros(micros);
}

/** A microsecond after `time` (the API's fixed-width datetime form). */
function justAfter(time: string): string {
  const seconds = Date.parse(`${time.slice(0, 19)}Z`);
  return formatMicros(seconds * 1000 + Number(time.slice(20, 26)) + 1);
}

/**
 * When a write is made, in the transaction that queues it (one including
 * `cursors`): after the last write queued in `owner`'s data, by any tab
 * (IndexedDB runs the transactions one at a time), and no earlier than this
 * browser's last (`madeNow`). No two writes share a time, and none is made
 * before one queued ahead of it.
 */
export async function nextMade(
  db: CommandsnippetsDatabase,
  owner: string
): Promise<string> {
  const now = madeNow();
  const last = (await db.cursors.get([owner, MADE_KEY]))?.after;
  const made = last !== undefined && last >= now ? justAfter(last) : now;
  await db.cursors.put({owner, key: MADE_KEY, after: made});
  return made;
}
