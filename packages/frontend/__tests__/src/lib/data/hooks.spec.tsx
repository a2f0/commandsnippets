import {render, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import {describe, expect, it} from 'vitest';

import {useSession} from '../../../../src/lib/data/hooks';
import {type SyncSession, syncSession} from '../../../../src/lib/sync/session';
import {signIn, TEST_USER} from '../../../util/signIn';

describe('useSession', () => {
  it('opens the next session when another tab signs out and in', async () => {
    signIn();
    const shown: Array<SyncSession | null> = [];
    const Probe = () => {
      shown.push(useSession());
      return null;
    };
    render(<Probe />);
    const first = syncSession(TEST_USER);
    expect(shown.at(-1)).toBe(first);
    await first.db.open();

    // Another tab's sign-out deletes the database (its sign-in opens anew).
    await Dexie.delete(first.db.name);

    await waitFor(() => expect(shown.at(-1)).not.toBe(first));
    expect(shown.at(-1)).toBe(syncSession(TEST_USER));
  });
});
