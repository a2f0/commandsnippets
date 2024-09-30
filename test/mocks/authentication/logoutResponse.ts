import type {JsonObject} from '@wdio/types';

import {ILogoutJsonApiResponse} from '../../../src/lib/authentication';

const logOutPostResponse: ILogoutJsonApiResponse & JsonObject = {data: {}};

export default logOutPostResponse;
