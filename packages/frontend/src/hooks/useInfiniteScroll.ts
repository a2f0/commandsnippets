import {useEffect, useEffectEvent, useState} from 'react';

/**
 * Infinite scrolling: call `loadMore` when the element given the returned ref
 * (a footer below the list) comes within 400px of the viewport, while
 * `enabled`. Disable it while a page loads, after one fails, and once there is
 * no next page. Each re-enable observes the footer afresh, so a short batch
 * that leaves it in view loads the next one, and each observer requests only
 * once, even before the caller commits its loading state.
 */
export function useInfiniteScroll(
  loadMore: () => void,
  enabled: boolean
): (element: Element | null) => void {
  const [target, setTarget] = useState<Element | null>(null);
  const reached = useEffectEvent(loadMore);

  useEffect(() => {
    if (
      target === null ||
      !enabled ||
      typeof IntersectionObserver === 'undefined'
    )
      return undefined;

    let active = true;
    const observer = new IntersectionObserver(
      entries => {
        if (!active || !entries.some(entry => entry.isIntersecting)) return;
        active = false;
        observer.disconnect();
        reached();
      },
      {rootMargin: '0px 0px 400px 0px'}
    );
    observer.observe(target);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [target, enabled]);

  return setTarget;
}
