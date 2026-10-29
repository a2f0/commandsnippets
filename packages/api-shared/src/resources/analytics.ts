/** Owner-only activity aggregates. Calendar dates and buckets use UTC. */
import * as z from 'zod/mini';
import {
  countSchema,
  resourceIdSchema,
  versionSchema,
} from '../jsonapi/response';

export const analyticsActivitySchema = z.enum([
  'created',
  'tags_created',
  'tagged',
  'reused',
]);
export const analyticsIntervalSchema = z.enum(['day', 'week', 'month']);
export const analyticsDateSchema = z.iso.date();

/** Shared by the date controls and the request validator. */
export function isAnalyticsRange(from: string, to: string): boolean {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  return (
    analyticsDateSchema.safeParse(from).success &&
    analyticsDateSchema.safeParse(to).success &&
    days >= 0 &&
    days <= 3660
  );
}

const rankingSchema = z.object({
  id: resourceIdSchema,
  name: z.string(),
  count: countSchema,
});

export const analyticsDocumentSchema = z.object({
  data: z.object({
    version: versionSchema,
    activity: analyticsActivitySchema,
    interval: analyticsIntervalSchema,
    from: analyticsDateSchema,
    to: analyticsDateSchema,
    total: countSchema,
    entries: countSchema,
    tags: countSchema,
    timeline: z.array(
      z.object({date: analyticsDateSchema, count: countSchema})
    ),
    top_tags: z.array(rankingSchema),
    top_entries: z.array(rankingSchema),
  }),
});

export type AnalyticsDocument = z.output<typeof analyticsDocumentSchema>;
export type Analytics = AnalyticsDocument['data'];
