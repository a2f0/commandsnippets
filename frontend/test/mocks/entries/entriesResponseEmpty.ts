import type {JsonObject} from '@wdio/types';

import type {ITextEntryJsonApiResponse} from '../../../src/lib/api/responses/types';
export const entriesResponseEmpty: ITextEntryJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
  included: [],
};
