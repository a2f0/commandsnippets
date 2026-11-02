/** Issues as error objects: how a failed parse is answered. */
import type * as z from 'zod/mini';
import {DOCUMENT_POINTER, errorMeta} from '../issues';
import type {ErrorObject} from './response';

/**
 * An issue as the API's error object. The pointer is the issue's own, else
 * the failing field's under `base` (e.g. `/data/attributes/name`), else
 * `/data`.
 */
export function toErrorObject(
  issue: z.core.$ZodIssue,
  base?: string
): ErrorObject {
  const {code, status = 400, pointer} = errorMeta(issue);
  return {
    detail: issue.message,
    status: String(status),
    source: {
      pointer:
        pointer ??
        (base === undefined
          ? DOCUMENT_POINTER
          : [base, ...issue.path.map(String)].join('/')),
    },
    code,
  };
}
