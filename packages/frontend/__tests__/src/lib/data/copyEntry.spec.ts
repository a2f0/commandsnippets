import {vi} from 'vitest';
import {copyEntry} from '../../../../src/lib/data/copyEntry';
import {signIn, store} from '../../../util/signIn';

it('does not publish clipboard success into a different signed-in account', async () => {
  signIn();
  const pending = Promise.withResolvers<void>();
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockReturnValue(pending.promise)},
    configurable: true,
  });
  // Public copies have no session, but their feedback still belongs to the
  // account context in which they started.
  const result = copyEntry(null, '1', 'body');
  store.setLoggedInUser('replacement');
  pending.resolve();

  expect(await result).toBe(false);
});
