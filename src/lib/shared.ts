import {ITagJsonApi} from '../models/TagModel';
import {ITextEntryJsonApi} from '../models/TextEntryModel';

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

export enum keyCode {
  Tab = 9,
  Escape = 27,
}
