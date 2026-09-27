import type {JsonObject} from '@wdio/types';

import type {ITagJsonApiResponse} from '../../../src/lib/api/responses/types';

export const tagsResponseEmpty: ITagJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
};
