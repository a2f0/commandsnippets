import {BasePage} from '../../pageobjects/base';

const DATABASE = 'commandsnippets-test-test';
const STORES = ['tags', 'entries', 'junctions', 'cursors'];

/**
 * How many rows each store of the signed-in user's database holds; nothing
 * until the app has created it (opening it here first would create an empty
 * one).
 */
function countRows(): Promise<Record<string, number>> {
  return browser.execute(
    async (name: string, stores: string[]) => {
      const databases = await indexedDB.databases();
      if (!databases.some(database => database.name === name)) {
        return {};
      }
      return new Promise<Record<string, number>>(resolve => {
        const request = indexedDB.open(name);
        request.onerror = () => resolve({});
        request.onsuccess = () => {
          const db = request.result;
          if (stores.some(store => !db.objectStoreNames.contains(store))) {
            db.close();
            resolve({});
            return;
          }
          const transaction = db.transaction(stores, 'readonly');
          const counts: Record<string, number> = {};
          for (const store of stores) {
            const count = transaction.objectStore(store).count();
            count.onsuccess = () => {
              counts[store] = count.result;
            };
          }
          transaction.oncomplete = () => {
            db.close();
            resolve(counts);
          };
        };
      });
    },
    DATABASE,
    STORES
  );
}

describe('Debug: Sync IndexedDB', () => {
  it("syncs the user's collection into IndexedDB", async () => {
    await BasePage.signIn('');

    await BasePage.debugMenuButton.waitAndLeftClick();
    await BasePage.debugMenuSyncIndexedDB.waitAndLeftClick();

    // The mock API's 4 tags, 3 entries and 2 junctions, with the cursors:
    // the master two and one per tag, the account the data is bound to, and
    // the data version it is of.
    await browser.waitUntil(async () => (await countRows())['cursors'] === 8, {
      timeoutMsg: 'the sync did not finish',
    });
    expect(await countRows()).toEqual({
      tags: 4,
      entries: 3,
      junctions: 2,
      cursors: 8,
    });
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
