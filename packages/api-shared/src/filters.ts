/**
 * `filter[...]` values: each takes the (non-empty) query-string value and
 * outputs what the filter compares against. Their messages are
 * django-filter's form-field errors, except the admin API's, which use DRF's
 * serializer-field wording.
 */
import * as z from 'zod/mini';
import {parseDateTime} from './datetime';
import {parseBoolean} from './fields';
import {fail, QUERY_ERROR} from './issues';
import {MESSAGES} from './messages';

/** A filter value schema: a query-string value in, the compared value out. */
export type FilterSchema = z.ZodMiniType<unknown, string>;

/** Any string, compared as is (e.g. a name or username). */
export const textFilter = z.string();

/** django-filter's NumberFilter: an integer, optionally signed and padded. */
export const integerFilter = z.pipe(
  z.string(),
  z.transform((value: string, ctx) =>
    /^-?\d+$/.test(value.trim())
      ? Number(value)
      : fail(ctx, MESSAGES.enterANumber, QUERY_ERROR)
  )
);

/** django-filter's BooleanFilter, with DRF's spellings (`parseBoolean`). */
export const booleanFilter = z.pipe(
  z.string(),
  z.transform((value: string, ctx) => {
    const parsed = parseBoolean(value);
    return parsed ?? fail(ctx, MESSAGES.enterABoolean, QUERY_ERROR);
  })
);

/**
 * django-filter's DateTimeFilter (`parseDateTime`'s forms), output in the
 * fixed-width naive-UTC form timestamps are compared in.
 */
export const dateTimeFilter = z.pipe(
  z.string(),
  z.transform((value: string, ctx) => {
    const parsed = parseDateTime(value);
    return parsed ?? fail(ctx, MESSAGES.enterADateTime, QUERY_ERROR);
  })
);

/** A boolean in DRF BooleanField's wording (the admin API's filters). */
export const booleanFieldFilter = z.pipe(
  z.string(),
  z.transform((value: string, ctx) => {
    const parsed = parseBoolean(value);
    return parsed ?? fail(ctx, MESSAGES.notABoolean, QUERY_ERROR);
  })
);

/** A primary key in DRF IntegerField's wording (the admin API's filters). */
export const pkFilter = z.pipe(
  z.string(),
  z.transform((value: string, ctx) =>
    /^\d+$/.test(value)
      ? Number(value)
      : fail(ctx, MESSAGES.notAnInteger, QUERY_ERROR)
  )
);
