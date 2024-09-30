import {ILogoutJsonApiResponse} from '../../../src/lib/authentication';
import type {JsonObject} from '@wdio/types';

const logOutPostResponse: ILogoutJsonApiResponse & JsonObject = {data: {}};

export default logOutPostResponse;
