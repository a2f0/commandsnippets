import {ITextEntryJsonApiResponse} from '../../../src/lib/text_entries';
import {JsonObject} from '@wdio/types';
const entriesResponseEmpty: ITextEntryJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
  included: [],
};

export default entriesResponseEmpty;
