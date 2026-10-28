import * as z from 'zod/mini';
import {
  analyticsActivitySchema,
  analyticsDateSchema,
  analyticsIntervalSchema,
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
    z.refine(
      value => {
        const days =
          (Date.parse(value.to) - Date.parse(value.from)) / 86_400_000;
        return days >= 0 && days <= 3660;
      },
      {message: 'Choose an ordered date range of at most ten years.'}
    )
  );

export type AnalyticsParams = z.output<typeof analyticsQuerySchema>;
