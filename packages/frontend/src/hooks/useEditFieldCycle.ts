import {type RefObject, useEffect} from 'react';
import {activeEntryEditField, activeTagEditField, appMode} from '../lib/shared';
import {type AppState, useAppConfig} from '../lib/state/appState';

/** An editor's fields, of which the app state holds the active one. */
export interface IEditFields<Field> {
  /** The app mode while the editor is open: Tab cycles its fields only then. */
  mode: appMode;
  /** The fields in Tab order; Tab on the last goes back to the first. */
  order: readonly Field[];
  save: Field;
  cancel: Field;
  active: (state: AppState) => Field;
  setActive: (state: AppState, field: Field) => void;
}

/** The entry editors' (`EntryForm`) fields. */
export const entryEditFields: IEditFields<activeEntryEditField> = {
  mode: appMode.entryEditor,
  order: [
    activeEntryEditField.subject,
    activeEntryEditField.body,
    activeEntryEditField.save,
    activeEntryEditField.cancel,
  ],
  save: activeEntryEditField.save,
  cancel: activeEntryEditField.cancel,
  active: state => state.activeEntryEditField,
  setActive: (state, field) => state.setActiveEntryEditField(field),
};

/** A new tag's form's (`TagNew`) fields. */
export const tagEditFields: IEditFields<activeTagEditField> = {
  mode: appMode.tagEditor,
  order: [
    activeTagEditField.name,
    activeTagEditField.save,
    activeTagEditField.cancel,
  ],
  save: activeTagEditField.save,
  cancel: activeTagEditField.cancel,
  active: state => state.activeTagEditField,
  setActive: (state, field) => state.setActiveTagEditField(field),
};

/**
 * Tab (Shift+Tab too) makes an open editor's next field the active one, in
 * place of the browser's focus move, and Save and Cancel are focused as they
 * become active (the text fields focus themselves).
 */
export function useEditFieldCycle<Field>(
  fields: IEditFields<Field>,
  buttons: {
    save: RefObject<HTMLButtonElement | null>;
    cancel: RefObject<HTMLButtonElement | null>;
  }
): void {
  const appConfig = useAppConfig();
  // Read as the editor renders, so it renders again when either changes;
  // the listener and the focus read the state as it is when they run.
  const active = fields.active(appConfig);
  const mode = appConfig.appMode;

  useEffect(() => {
    const keyListener = (event: KeyboardEvent) => {
      if (event.code !== 'Tab' || appConfig.appMode !== fields.mode) {
        return;
      }
      const {order} = fields;
      const next =
        order[(order.indexOf(fields.active(appConfig)) + 1) % order.length];
      if (next !== undefined) {
        fields.setActive(appConfig, next);
      }
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('keydown', keyListener, false);
    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [active, mode]);

  useEffect(() => {
    const field = fields.active(appConfig);
    if (field === fields.save) {
      buttons.save.current?.focus();
    } else if (field === fields.cancel) {
      buttons.cancel.current?.focus();
    }
  }, [active]);
}
