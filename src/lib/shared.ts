import * as Constants from '../constants';
import {ITagJsonApi} from '../models/TagModel';
import {ITextEntryJsonApi} from '../models/TextEntryModel';
import {Theme} from '@mui/material/styles';

export enum keyCode {
  Tab = 9,
  Enter = 13,
  Escape = 27,
  LeftArrow = 37,
  UpArrow = 38,
  RightArrow = 39,
  DownArrow = 40,
}

export enum entrySearchMethod {
  allEntries = 1,
  currentTagOnly = 2,
  untaggedEntryList = 3,
}

export enum appMode {
  tagsList = 1,
  entriesList = 2,
}

export enum activeSearch {
  tags = 1,
  entries = 2,
}

export interface appState {
  loggedInUser: string | null;
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
}

export const defaultState: appState = {
  loggedInUser: null,
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
    mostRecentTimestamp = sortedArray[0].attributes.date_updated;
  }
  return mostRecentTimestamp;
}

export function needsScrollingIntoView(
  element: React.RefObject<HTMLDivElement>,
  theme: Theme
) {
  const rect = element.current?.getBoundingClientRect();
  if (rect !== undefined) {
    // Then it exists
    const topInView =
      rect.top >= Constants.appBarHeight + theme.main.paddingTop;
    const bottomInView =
      rect.bottom <=
      (window.innerHeight - Constants.footerHeight ||
        document.documentElement.clientHeight - Constants.footerHeight);
    const isInView = topInView && bottomInView;

    if (isInView === false) {
      // Then it needs to be scrolled
      return true;
    }
  }
  return false;
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
