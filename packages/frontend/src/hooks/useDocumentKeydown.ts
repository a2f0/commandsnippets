import {useEffect, useEffectEvent} from 'react';

/**
 * Calls `onKeydown` for every keydown in the document while the component is
 * mounted: the `onKeydown` of its latest render, though it listens from the
 * first.
 */
export function useDocumentKeydown(
  onKeydown: (event: KeyboardEvent) => void
): void {
  const handle = useEffectEvent(onKeydown);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);
}
