import invariant from 'invariant';
import {describe, expect, it} from 'vitest';

import {createStore, tag, testUser} from '../../../../util/storeFixtures';

describe('UserModel', () => {
  it('remove() removes the user and leaves a tag with the same id', () => {
    // Ids are per resource type, so a tag can share the user's id.
    const store = createStore([tag(testUser.id, {name: 'same-id'})]);
    const user = store.usersArray.find(u => u.id === testUser.id);
    invariant(user, 'the user should be in the store');

    user.remove();

    expect(store.usersArray).toHaveLength(0);
    expect(store.tagsArray.map(t => t.attributes.name)).toEqual(['same-id']);
  });
});
