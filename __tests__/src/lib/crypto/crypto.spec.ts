import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {TearleadsCrypto} from '../../../../src/lib/crypto/crypto';

describe('Crypto', () => {
  it('Generates a Key Pair', async () => {
    const crypto = new TearleadsCrypto();
    const keyPair = await crypto.generateKeyPair();
    expect(keyPair).not.toBe(undefined);
    console.info(keyPair);
  }, 10000);
});
