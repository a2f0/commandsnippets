import {ITextEntryJsonApiResponse} from '../../../src/lib/text_entries';
const entriesResponseEmpty: ITextEntryJsonApiResponse = {
  links: {
    next: null,
  },
  data: [],
  included: [],
};

export default entriesResponseEmpty;
