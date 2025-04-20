import type {JsonObject} from '@wdio/types';

import type {ITextEntryJsonApiResponseSingle} from '../../../src/lib/text_entries';
import {entriesResponse} from './entriesResponse';

// create a deep clone
const data = JSON.parse(JSON.stringify(entriesResponse.data[0]));
data.attributes.body += '\nentry-1-body-line-2';
data.attributes.subject += '-modified';

export const entryPatchResponse: ITextEntryJsonApiResponseSingle & JsonObject =
  {
    data: data,
    included: [],
  };
