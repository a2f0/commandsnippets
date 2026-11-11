import type {FocusEvent, RefObject} from 'react';
import {activeEntryEditField, activeTagEditField} from '../lib/shared';
import {type AppState, useAppState} from '../lib/state/appState';
import {useDocumentKeydown} from './useDocumentKeydown';

interface IEditFields<Field> {
  order: readonly Field[];
  setActive: (state: AppState, field: Field) => void;
}

export const entryEditFields: IEditFields<activeEntryEditField> = {
  order: [
    activeEntryEditField.subject,
    activeEntryEditField.body,
    activeEntryEditField.save,
    activeEntryEditField.cancel,
  ],
  setActive: (state, field) => state.setActiveEntryEditField(field),
};

export const tagEditFields: IEditFields<activeTagEditField> = {
  order: [
    activeTagEditField.name,
    activeTagEditField.save,
    activeTagEditField.cancel,
  ],
  setActive: (state, field) => state.setActiveTagEditField(field),
};

/** Only this form's controls, not MUI's hidden textarea sizing mirror. */
const controlsOf = (root: HTMLDivElement | null) =>
  Array.from(
    root?.querySelectorAll<HTMLElement>(
      'input, textarea:not([aria-hidden]), button'
    ) ?? []
  );

/** Tab cycles only the owning form; focus never follows another form's field. */
export function useEditFieldCycle<Field>(
  fields: IEditFields<Field>,
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

  return (event: FocusEvent<HTMLDivElement>) => {
    const index = controlsOf(owner.ref.current).indexOf(event.target);
    const field = fields.order[index];
    if (field !== undefined && owner.ownsKeyboard()) {
      fields.setActive(useAppState.getState(), field);
    }
  };
}
