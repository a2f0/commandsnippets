/** The router's components (`navigation.ts`). */
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useEffect,
} from 'react';
import type {RouterHistory} from './history';
import {attachHistory, currentPath, navigate} from './navigation';

/**
 * The app below follows `history` (a test's memory history); without one,
 * the browser's. One at a time.
 */
export const Router = ({
  history,
  children,
}: {
  history?: RouterHistory;
  children: ReactNode;
}) => {
  if (history !== undefined) {
    attachHistory(history);
  }
  return children;
};

/**
 * Go to `to` once rendered (in place of the current entry, with `replace`):
 * a route that only sends elsewhere.
 */
export const Navigate = ({
  to,
  replace = false,
}: {
  to: string;
  replace?: boolean;
}) => {
  useEffect(() => {
    navigate(to, {replace});
  }, [to, replace]);
  return null;
};

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** An absolute path in the app, with a query. */
  to: string;
  ref?: Ref<HTMLAnchorElement>;
};

/** Whether the browser should handle `event` itself: a new tab or window. */
const opensElsewhere = (
  event: MouseEvent<HTMLAnchorElement>,
  target: string | undefined
) =>
  event.button !== 0 ||
  (target !== undefined && target !== '_self') ||
  event.metaKey ||
  event.altKey ||
  event.ctrlKey ||
  event.shiftKey;

/**
 * A link in the app: a plain click goes to `to` here (in place of the current
 * entry when it is there already), and every other click (a new tab) is the
 * browser's. An `onClick` that prevents the default keeps it where it is.
 */
export const Link = ({to, onClick, target, ref, ...rest}: LinkProps) => (
  <a
    {...rest}
    ref={ref}
    href={to}
    target={target}
    onClick={event => {
      onClick?.(event);
      if (event.defaultPrevented || opensElsewhere(event, target)) {
        return;
      }
      event.preventDefault();
      navigate(to, {replace: to === currentPath()});
    }}
  />
);
