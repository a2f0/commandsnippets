import type {TextEntryListDocument} from '@commandsnippets/api-shared';
import {entrySearchMethod} from '../../src/lib/shared';

declare global {
  interface Window {
    /** The drag `Base.dragAndDrop` started, to go on with. */
    __E2E_DRAG__?: {
      from: Element;
      fire: (element: Element, type: string) => Promise<void>;
    };
  }
}

export class Base {
  // signed-out home screen
  get signInPage(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#signInPage');
  }

  // admin page
  get userModeTab(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#userModeTab');
  }
  get adminModeTab(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminModeTab');
  }
  get adminPage(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminPage');
  }
  adminUserRow(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#adminUserRow${id}`);
  }
  adminUserMenuButton(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#adminUserMenuButton${id}`);
  }
  get adminUserMenuDeactivate(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminUserMenuDeactivate');
  }
  get adminUserMenuReactivate(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminUserMenuReactivate');
  }
  get adminUserMenuMarkForDeletion(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminUserMenuMarkForDeletion');
  }
  get adminUserMenuViewData(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminUserMenuViewData');
  }
  get readOnlyBadge(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#readOnlyBadge');
  }
  get adminConfirmButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminConfirmButton');
  }
  get adminAuditLogTab(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminAuditLogTab');
  }
  get adminAuditLog(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#adminAuditLog');
  }

  // file menu
  get githubAuthButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#githubAuthButton');
  }
  get googleAuthButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#googleAuthButton');
  }
  // file menu
  get fileMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu');
  }
  get fileMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-button');
  }
  get fileMenuNewEntry(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-new-entry');
  }
  get fileMenuLogout(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#file-menu-logout');
  }

  // debug menu
  get debugMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#debug-menu-button');
  }
  get debugMenuSyncIndexedDB(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#debug-menu-sync-indexed-db');
  }

  // entries menu
  get entriesMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entries-menu');
  }
  get entriesMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entries-menu-button');
  }
  get entriesMenuUntagged(): ReturnType<WebdriverIO.Browser['$']> {
    return $(
      `#entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`
    );
  }

  // tags menu
  get tagsMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu');
  }
  get tagsMenuButton(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu-button');
  }
  get tagsMenuSortDateCreatedAscending(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tags-menu-sort-date-created-ascending');
  }
  get tagsMenuSortDateCreatedDescending(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tags-menu-sort-date-created-descending');
  }

  // tags
  get tagList(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagList');
  }
  /**
   * Returns all tag elements. This is a WebdriverIO array-like object.
   */
  get tags(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('div[id^="tag-"]');
  }
  get tagListContextMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagListContextMenu');
  }
  get tagNewBottomTextField(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomTextField');
  }
  get tagNewBottom(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottom');
  }
  get tagNewBottomCancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomCancel');
  }
  get tagNewBottomSave(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagNewBottomSave');
  }
  get tagListContextMenuNew(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagListContextMenuNew');
  }
  get tagContextMenu1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu-1');
  }
  get tagContextMenu1DeleteTagMenuItem(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu1DeleteTagMenuItem');
  }
  get tagContextMenu1DeleteTagDialog(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagContextMenu1DeleteTagDialog');
  }
  get tagContextMenu1DeleteTagDialogDeleteButton(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tagContextMenu1DeleteTagDialogDeleteButton');
  }
  get tagContextMenu1DeleteTagDialogCancelButton(): ReturnType<
    WebdriverIO.Browser['$']
  > {
    return $('#tagContextMenu1DeleteTagDialogCancelButton');
  }
  get tag1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tag-1');
  }
  get tag2(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tag-2');
  }
  tag(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tag-${id}`);
  }
  tagLabelWrapper(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagLabelWrapper-${id}`);
  }
  tagContextMenu(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagContextMenu-${id}`);
  }
  tagContextMenuEditTag(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tag-context-menu-${id}-edit-tag`);
  }
  tagEditTagName(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagEditTagName${id}`);
  }
  tagEditSave(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagEditSave${id}`);
  }
  get tagSearch(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagSearch');
  }

  // entries
  get entryNewTop(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTop');
  }
  get entryNewTopSubject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopSubject');
  }
  get entryNewTopBody(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopBody');
  }
  get entryNewTopSave(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewTopSave');
  }
  get entryNewBottom(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottom');
  }
  get entryNewBottomSubject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomSubject');
  }
  get entryNewBottomBody(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryNewBottomBody');
  }
  get entryListContextMenu(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entryListContextMenu');
  }
  get entryListContextMenuNewEntry(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#entryListContextMenuNewEntry');
  }
  get tagsEntriesList(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesList');
  }
  /**
   * Returns all tagsEntries elements. This is a WebdriverIO array-like object.
   */
  get tagsEntries(): ReturnType<WebdriverIO.Browser['$$']> {
    return $$('div[id^="tagsEntries-"]');
  }
  get tagsEntriesContextMenu1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu-1');
  }
  get tagsEntriesContextMenu1Edit(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu1Edit');
  }
  get tagsEntriesContextMenu1Untag(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntriesContextMenu1Untag');
  }
  get textEntryEdit1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1');
  }
  get textEntryEdit1Subject(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Subject');
  }
  get textEntryEdit1Body(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Body');
  }
  get textEntryEdit1Save(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Save');
  }
  get textEntryEdit1Cancel(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntryEdit1Cancel');
  }
  get tagsEntries1(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#tagsEntries-1');
  }
  tagsEntry(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagsEntries-${id}`);
  }
  tagsEntryContextMenu(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagsEntriesContextMenu-${id}`);
  }
  tagsEntryContextMenuDelete(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagsEntriesContextMenu${id}Delete`);
  }
  tagsEntryContextMenuUntag(id: string): ReturnType<WebdriverIO.Browser['$']> {
    return $(`#tagsEntriesContextMenu${id}Untag`);
  }
  get entrySearch(): ReturnType<WebdriverIO.Browser['$']> {
    return $('#textEntrySearch');
  }
  async open(
    path: string,
    options: Parameters<WebdriverIO.Browser['url']>[1] = {}
  ): Promise<void> {
    await browser.url(`http://localhost:8081/${path}`, options);

    // Wait for MSW to be ready after page load
    await browser.waitForMSW();
  }

  /**
   * Open `path` signed in as the mock API's user (`test`), from the sign-in
   * page (`login()` needs a page of the app). The sign-in page loads signed
   * out, whatever an earlier test of the spec saved: signed in, it would
   * start its sync, and leaving it for `path` cuts those requests off, which
   * the mock service worker, its page gone, sends to the network (a
   * `TypeError: Failed to fetch` logged). With `entries`, the mock API lists
   * those entries (`overrideEntries`), which the page at `path` syncs.
   */
  async signIn(
    path: string,
    {entries}: {entries?: TextEntryListDocument} = {}
  ): Promise<void> {
    await this.open('', {onBeforeLoad: () => localStorage.clear()});
    await this.signInPage.waitForDisplayed();
    if (entries !== undefined) {
      await this.overrideEntries(entries);
    }
    await browser.login();
    await this.open(path);
  }

  /**
   * Have the mock API list `entries`, across page loads, until MSW is reset
   * after the test.
   */
  async overrideEntries(entries: TextEntryListDocument): Promise<void> {
    // As one JSON string: WebDriver serializes an object argument node by
    // node, which takes tens of seconds for this many entries.
    const overridden = await browser.execute(json => {
      if (!window.setRuntimeEntriesOverride) {
        return false;
      }
      window.setRuntimeEntriesOverride(JSON.parse(json));
      return true;
    }, JSON.stringify(entries));
    if (!overridden) {
      throw new Error('setRuntimeEntriesOverride not available');
    }
  }

  /**
   * Drag the element at `source` onto the one at `target` with the HTML5
   * drag events React DnD's HTML5 backend listens for. WebDriver's pointer
   * actions cannot start a native drag in Chrome, so the page dispatches
   * them, a moment apart (the backend publishes the drag source a tick after
   * `dragstart`). `whileDragging` runs once the drag has started, before it
   * enters the target. Resolves whether the source was still in the page
   * then (a list can unmount the rows it scrolls away).
   */
  async dragAndDrop(
    source: string,
    target: string,
    {whileDragging}: {whileDragging?: () => Promise<unknown>} = {}
  ): Promise<boolean> {
    await browser.execute(async (sourceSelector: string) => {
      const from = document.querySelector(sourceSelector);
      if (from === null) {
        throw new Error(`No ${sourceSelector}`);
      }
      const dataTransfer = new DataTransfer();
      const fire = async (element: Element, type: string) => {
        const {left, top, width, height} = element.getBoundingClientRect();
        element.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer,
            clientX: left + width / 2,
            clientY: top + height / 2,
          })
        );
        await new Promise(resolve => setTimeout(resolve, 50));
      };
      window.__E2E_DRAG__ = {from, fire};
      await fire(from, 'dragstart');
    }, source);
    await whileDragging?.();
    return browser.execute(async (targetSelector: string) => {
      const drag = window.__E2E_DRAG__;
      delete window.__E2E_DRAG__;
      const to = document.querySelector(targetSelector);
      if (drag === undefined || to === null) {
        throw new Error(`No drag started, or no ${targetSelector}`);
      }
      const sourceKept = drag.from.isConnected;
      await drag.fire(to, 'dragenter');
      await drag.fire(to, 'dragover');
      await drag.fire(to, 'drop');
      await drag.fire(drag.from, 'dragend');
      return sourceKept;
    }, target);
  }

  /** GET `path` from the (mocked) API, from the page, as JSON. */
  async fetchApi(path: string): Promise<unknown> {
    return browser.execute(async (url: string) => {
      const response = await fetch(url);
      return response.json();
    }, `http://localhost:9001/api/v1${path}`);
  }

  // Helper methods for API checks
  async checkTagsAndEntries(options: {withFirstEntry?: boolean} = {}) {
    return browser.execute(async opts => {
      const API_BASE_URL = 'http://localhost:9001/api/v1';

      // Helper function to safely fetch and parse JSON
      const process = async (url: string) => {
        const response = await fetch(url);
        const data = response.ok ? await response.json() : null;
        return {ok: response.ok, data};
      };

      const [tagsResult, entriesResult] = await Promise.all([
        process(`${API_BASE_URL}/tags`),
        process(`${API_BASE_URL}/entries`),
      ]);

      const result: {
        tagsOk: boolean;
        tagsCount: number;
        entriesOk: boolean;
        entriesCount: number;
        firstEntry?: unknown;
      } = {
        tagsOk: tagsResult.ok,
        tagsCount: tagsResult.data?.data?.length || 0,
        entriesOk: entriesResult.ok,
        entriesCount: entriesResult.data?.data?.length || 0,
      };

      if (opts.withFirstEntry) {
        result.firstEntry = entriesResult.data?.data?.[0] || null;
      }

      return result;
    }, options);
  }

  async checkTags() {
    return browser.execute(async () => {
      const API_BASE_URL = 'http://localhost:9001/api/v1';
      const response = await fetch(`${API_BASE_URL}/tags`);
      const data = response.ok ? await response.json() : null;
      return {ok: response.ok, dataLength: data?.data?.length || 0};
    });
  }
}

const BasePage = new Base();

export {BasePage};
