import {BasePage} from '../../pageobjects/base';

const DATABASE = 'commandsnippets-test-test';
const STORES = ['tags', 'entries', 'junctions', 'cursors'];

/**
 * How many rows each store of the signed-in user's database holds; nothing
 * until the app has created it (opening it here first would create an empty
 * one).
 */
function countRows(): Promise<Record<string, number>> {
  return browser.executeAsync(
    (
      name: string,
      stores: string[],
      done: (counts: Record<string, number>) => void
    ) => {
      indexedDB.databases().then(databases => {
        if (!databases.some(database => database.name === name)) {
          done({});
          return;
        }
        const request = indexedDB.open(name);
        request.onerror = () => done({});
        request.onsuccess = () => {
          const db = request.result;
          if (stores.some(store => !db.objectStoreNames.contains(store))) {
            db.close();
            done({});
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
            done(counts);
          };
        };
      });
    },
    DATABASE,
    STORES
  );
}

describe('Debug: Sync IndexedDB', () => {
  afterEach(async () => {
    await browser.resetMSWHandlers();
  });

  it("syncs the user's collection into IndexedDB", async () => {
    await BasePage.open('');
    await expect(BasePage.signInPage).toBeDisplayed();
    await browser.login();
    await BasePage.open('');

    await BasePage.debugMenuButton.waitAndLeftClick();
    await BasePage.debugMenuSyncIndexedDB.waitAndLeftClick();

    // The mock API's 4 tags, 3 entries and 2 junctions, with the cursors:
    // the master two and one per tag.
    await browser.waitUntil(async () => (await countRows())['cursors'] === 6, {
      timeoutMsg: 'the sync did not finish',
    });
    expect(await countRows()).toEqual({
      tags: 4,
      entries: 3,
      junctions: 2,
      cursors: 6,
    });
    expect(browser.currentTestErrors).toHaveLength(0);
  });
});
