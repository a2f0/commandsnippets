/** A local id replaced by the API's, once its create reached the API. */
export interface Remap {
  owner: string;
  type: string;
  from: string;
  to: string;
}

const remapListeners = new Set<(remap: Remap) => void>();

// Every tab hears of a remap (each keeps its own selection), the flushing
// one directly and the others over this channel.
const remapChannel =
  typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel('commandsnippets-remaps');

function notifyRemap(remap: Remap): void {
  for (const listener of remapListeners) {
    listener(remap);
  }
}

if (remapChannel !== null) {
  remapChannel.onmessage = ({data}: MessageEvent<Remap>) => notifyRemap(data);
}

/** Tell this tab and the others of `remaps`, once they are stored. */
export function announceRemaps(remaps: readonly Remap[]): void {
  for (const remap of remaps) {
    notifyRemap(remap);
    remapChannel?.postMessage(remap);
  }
}

/**
 * Call `listener` whenever a local id is replaced by the API's, in this tab
 * or another (for state that holds ids, like the UI's selection). Returns
 * the unsubscribe.
 */
export function subscribeRemaps(listener: (remap: Remap) => void): () => void {
  remapListeners.add(listener);
  return () => {
    remapListeners.delete(listener);
  };
}
