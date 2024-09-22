import {ITagJsonApiResponse} from '../../../src/lib/tags';
import {JsonObject} from '@wdio/types';

const tagsResponseEmpty: ITagJsonApiResponse & JsonObject = {
  links: {
    next: null,
  },
  data: [],
};

export default tagsResponseEmpty;
