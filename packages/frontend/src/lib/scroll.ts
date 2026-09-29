import type {Theme} from '@mui/material/styles';
import type {RefObject} from 'react';

/**
 * Whether `element` is out of the part of the window between the app bar and
 * the footer, so selecting it should scroll it into view.
 */
export function needsScrollingIntoView(
  element:
    | RefObject<HTMLDivElement | null>
    | RefObject<HTMLButtonElement | null>
    | RefObject<HTMLLIElement | null>
    | null,
  theme: Theme
) {
  if (element === null) {
    return false;
  }
  const rect = element.current?.getBoundingClientRect();
  if (rect !== undefined) {
    const bottomInView =
      rect.bottom <=
      (window.innerHeight - theme.footer.height ||
        document.documentElement.clientHeight - theme.footer.height);
    if (bottomInView === false) {
      return true;
    }

    const topInView = rect.top >= theme.appBar.height;

    if (topInView === false) {
      return true;
    }
  } else {
    throw new Error('needsScrollingIntoView expects rectangle');
  }
  return false;
}
