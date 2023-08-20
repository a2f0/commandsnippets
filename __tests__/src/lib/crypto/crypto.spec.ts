import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {TearleadsCrypto} from '../../../../src/lib/crypto/crypto';

describe('Crypto', () => {
  it('Can be constructed', async () => {
    new TearleadsCrypto();
  });
});
