import type {TextEntry} from '@commandsnippets/api-shared/responses';

/**
 * Whether the entry is a shortcut (keys to press): drawn as keys, and with
 * nothing to copy, so it has no Copy and a click only selects it.
 */
export const isShortcut = (entry: Pick<TextEntry, 'attributes'>): boolean =>
  entry.attributes.kind === 'shortcut';
