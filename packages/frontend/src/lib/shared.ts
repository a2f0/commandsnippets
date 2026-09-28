import invariant from 'invariant';
import type {ITagJsonApi, ITextEntryJsonApi} from './api/responses/types';

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

export interface appState {
  loggedInUser: string | null;
  isStaff: boolean;
  selectedTheme: string;
  tagSortOrder: string;
  entryNew: string | null;
  tagTextEntryThroughModelSortOrder: string;
  entrySearchMethod: entrySearchMethod;
  entrySortOrder: string;
  tagNew: string | null;
  tagSearch: boolean;
  mostRecentCopyType: string | null;
  mostRecentCopyID: string | null;
  showTagCounts: boolean;
  activeEntryEditField: activeEntryEditField;
  activeTagEditField: activeTagEditField;
  allEntriesCacheTimestamp: string;
}

export const defaultState: appState = {
  loggedInUser: null,
  isStaff: false,
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
  entryNew: null,
  tagTextEntryThroughModelSortOrder: 'order',
  entrySearchMethod: entrySearchMethod.currentTagOnly,
  entrySortOrder: 'date_updated',
  tagNew: null,
  tagSearch: false,
  mostRecentCopyType: null,
  mostRecentCopyID: null,
  showTagCounts: false,
  activeEntryEditField: activeEntryEditField.subject,
  activeTagEditField: activeTagEditField.name,
  allEntriesCacheTimestamp: '1970-01-01T00:00:00.000Z',
};

export function getMostRecentTimeStamp(
  array: Array<ITextEntryJsonApi> | Array<ITagJsonApi>
): string | null {
  let mostRecentTimestamp: string | null = null;
  if (array.length > 0) {
    const sortedArray: Array<ITextEntryJsonApi> | Array<ITagJsonApi> = array
      .slice()
      .sort((a, b) => {
        const sort1 = new Date(a.attributes.date_updated);
        const sort2 = new Date(b.attributes.date_updated);
        if (sort2 < sort1) {
          return -1;
        }
        if (sort2 > sort1) {
          return 1;
        }
        return 0;
      });
    invariant(sortedArray[0], 'sortedArray is undefined');
    mostRecentTimestamp = sortedArray[0].attributes.date_updated;
  }
  return mostRecentTimestamp;
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
