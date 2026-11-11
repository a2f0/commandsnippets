import type {SQL} from 'drizzle-orm';
import {describe, expectTypeOf, it} from 'vitest';
import type {listResponse} from '../../src/resources/viewset';

type Options = Parameters<typeof listResponse>[1];
type Collection = Omit<Options, 'publicOnly' | 'visibility'>;

describe('list visibility type contract', () => {
  it('accepts owned reads and public reads with a concrete predicate', () => {
    expectTypeOf<Collection>().toExtend<Options>();
    expectTypeOf<Collection & {publicOnly: false}>().toExtend<Options>();
    expectTypeOf<
      Collection & {publicOnly: true; visibility: SQL}
    >().toExtend<Options>();
  });

  it('rejects public reads without a concrete predicate', () => {
    expectTypeOf<Collection & {publicOnly: true}>().not.toExtend<Options>();
    expectTypeOf<
      Collection & {publicOnly: true; visibility: undefined}
    >().not.toExtend<Options>();
    expectTypeOf<
      Collection & {publicOnly: true; visibility: SQL | undefined}
    >().not.toExtend<Options>();
  });

  it('rejects predicates without the public discriminator', () => {
    expectTypeOf<Collection & {visibility: SQL}>().not.toExtend<Options>();
    expectTypeOf<
      Collection & {publicOnly: false; visibility: SQL}
    >().not.toExtend<Options>();
    expectTypeOf<
      Collection & {publicOnly: boolean; visibility: SQL}
    >().not.toExtend<Options>();
  });
});
