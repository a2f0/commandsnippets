import {JsonObject} from '@wdio/types';

import {ITextEntryJsonApiResponse} from '../../../src/lib/text_entries';
const entriesResponseEmpty: ITextEntryJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
  included: [],
};

export default entriesResponseEmpty;
