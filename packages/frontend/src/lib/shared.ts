export enum entrySearchMethod {
  allEntries = 1,
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

export interface IMouse {
  mouseX: number | null;
  mouseY: number | null;
}

export const initialMouse: IMouse = {
  mouseX: null,
  mouseY: null,
};
