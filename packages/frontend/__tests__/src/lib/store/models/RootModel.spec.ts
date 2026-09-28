// Load the model before anything imports the store module. When the API
// client's 401/403 handling imported the store, this order hit the import
// cycle (store -> RootModel -> API client -> store) and RootModel was not yet
// initialized when the store module created it.
import {RootModel} from '../../../../../src/lib/store/models/RootModel';

describe('RootModel', () => {
  it('can be imported and created before the store module', () => {
    const root = RootModel.create({
      selectedTheme: 'darkTheme',
      tagSortOrder: 'order',
      entryNew: null,
      tagTextEntryThroughModelSortOrder: 'order',
      entrySortOrder: 'date_updated',
      tagNew: null,
      tagSearch: false,
      mostRecentCopyType: null,
      mostRecentCopyID: null,
      currentTag: null,
      currentUser: null,
      showTagCounts: false,
      allEntriesCacheTimestamp: '1970-01-01T00:00:00.000Z',
    });

    expect(root.loggedInUser).toBeNull();
    expect(root.isStaff).toBe(false);
    expect(root.tagSortOrder).toBe('order');
  });
});
