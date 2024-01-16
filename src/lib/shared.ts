import {ITagJsonApi} from '../models/TagModel';
import {ITextEntryJsonApi} from '../models/TextEntryModel';
import Theme from '../theme/themeBase';

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
  activeEntryEditField: activeEntryEditField.subject,
  activeTagEditField: activeTagEditField.name,
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
  element: React.RefObject<HTMLLIElement | HTMLDivElement>,
  theme: typeof Theme
) {
  const rect = element.current?.getBoundingClientRect();
  if (rect !== undefined) {
    // Then it exists
    const topInView = rect.top >= theme.appBar.height + theme.main.paddingTop;
    const bottomInView =
      rect.bottom <=
      (window.innerHeight - theme.footer.height ||
        document.documentElement.clientHeight - theme.footer.height);
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
