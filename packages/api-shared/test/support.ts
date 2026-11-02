/** Reading schema results in tests. */
import {expect} from 'bun:test';
import type * as z from 'zod/mini';
import {type ErrorMeta, errorMeta} from '../src/issues';

export interface Failure extends ErrorMeta {
  message: string;
  path: PropertyKey[];
}

/** Every issue `schema` reports for `input`, with its error metadata. */
export function failures(schema: z.ZodMiniType, input: unknown): Failure[] {
  const result = schema.safeParse(input);
  expect(result.success).toBe(false);
  return (result.error?.issues ?? []).map(issue => ({
    message: issue.message,
    path: issue.path,
    ...errorMeta(issue),
  }));
}

/** The one issue `schema` reports for `input`, as `[message, code]`. */
export function failure(
  schema: z.ZodMiniType,
  input: unknown
): [string, string] {
  const [first, ...rest] = failures(schema, input);
  expect(rest).toEqual([]);
  if (first === undefined) {
    throw new Error('Expected one issue');
  }
  return [first.message, first.code];
}

/** What `schema` outputs for `input` (it must parse). */
export function parsed<S extends z.ZodMiniType>(
  schema: S,
  input: unknown
): z.output<S> {
  const result = schema.safeParse(input);
  expect(result.error?.issues ?? []).toEqual([]);
  if (!result.success) {
    throw new Error('Expected the input to parse');
  }
  return result.data;
}
