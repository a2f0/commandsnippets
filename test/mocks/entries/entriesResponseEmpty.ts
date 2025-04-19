import type {JsonObject} from '@wdio/types';

import type {ITextEntryJsonApiResponse} from '../../../src/lib/text_entries';
export const entriesResponseEmpty: ITextEntryJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
  included: [],
};
