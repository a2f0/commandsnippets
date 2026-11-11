import type {RefObject} from 'react';
import {useDocumentKeydown} from './useDocumentKeydown';

/** Only this form's controls, not MUI's hidden textarea sizing mirror. */
const controlsOf = (root: HTMLDivElement | null) =>
  Array.from(
    root?.querySelectorAll<HTMLElement>(
      'input, textarea:not([aria-hidden]), button'
    ) ?? []
  );

/** Tab cycles only the owning form; focus never follows another form's field. */
export function useEditFieldCycle(
  owner: {ref: RefObject<HTMLDivElement | null>; ownsKeyboard: () => boolean},
  enabled = true
) {
  useDocumentKeydown(event => {
    if (
      !enabled ||
      event.defaultPrevented ||
      event.code !== 'Tab' ||
      !owner.ownsKeyboard()
    )
      return;
    const controls = controlsOf(owner.ref.current);
    const focused = document.activeElement;
    const index =
      focused instanceof HTMLElement ? controls.indexOf(focused) : -1;
    const next = (index + 1) % controls.length;
    controls[next]?.focus();
    event.preventDefault();
    event.stopPropagation();
  });
}
