import type {JsonObject} from '@wdio/types';

import type {ITagJsonApiResponse} from '../../../src/lib/tags';

const tagsResponseEmpty: ITagJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
};

export default tagsResponseEmpty;
