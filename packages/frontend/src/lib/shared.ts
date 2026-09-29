export enum entrySearchMethod {
  allEntries = 1,
  currentTagOnly = 2,
  untaggedEntryList = 3,
}

export enum appMode {
  tagsList = 1,
  entriesList = 2,
  entryEditor = 3,
  tagEditor = 4,
}

export enum activeSearch {
  tags = 1,
  entries = 2,
}

export enum activeEntryEditField {
  subject = 1,
  body = 2,
  save = 3,
  cancel = 4,
}

export enum activeTagEditField {
  name = 1,
  save = 2,
  cancel = 3,
}

export function getSelection() {
  let selection: Selection | null = null;
  if (window.getSelection) {
    selection = window.getSelection();
  } else if (window.document.getSelection) {
    selection = window.document.getSelection();
  }
  return selection;
}

export interface IMouse {
  mouseX: number | null;
  mouseY: number | null;
}

export const initialMouse: IMouse = {
  mouseX: null,
  mouseY: null,
};
