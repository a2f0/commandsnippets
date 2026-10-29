import * as z from 'zod/mini';
import {fail, QUERY_ERROR} from '../../issues';
import {MESSAGES} from '../../messages';
import {
  analyticsActivitySchema,
  analyticsDateSchema,
  analyticsIntervalSchema,
  isAnalyticsRange,
} from '../analytics';

/** At most ten years per slice; bounds include the entire UTC calendar day. */
export const analyticsQuerySchema = z
  .strictObject({
    activity: analyticsActivitySchema,
    interval: analyticsIntervalSchema,
    from: analyticsDateSchema,
    to: analyticsDateSchema,
    tag: z.optional(z.string().check(z.regex(/^[1-9]\d*$/))),
  })
  .check(
    z.refine(value => isAnalyticsRange(value.from, value.to), {
      message: 'Choose an ordered date range of at most ten years.',
    })
  );

export type AnalyticsParams = z.output<typeof analyticsQuerySchema>;

/** Preserve repeated parameters until validation, as other query routes do. */
export const analyticsSearchQuerySchema = z.pipe(
  z.array(z.tuple([z.string(), z.string()])),
  z.transform((entries: Array<[string, string]>, ctx): AnalyticsParams => {
    const seen = new Set<string>();
    for (const [key] of entries) {
      if (seen.has(key))
        return fail(ctx, MESSAGES.repeatedQueryParameter(key), QUERY_ERROR);
      seen.add(key);
    }
    const result = analyticsQuerySchema.safeParse(Object.fromEntries(entries));
    if (result.success) return result.data;
    return fail(
      ctx,
      result.error.issues[0]?.message ?? 'Invalid analytics query.',
      QUERY_ERROR
    );
  })
);
