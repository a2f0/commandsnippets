import {Instance} from 'mobx-state-tree';
declare const AppStateStoreModel: import('mobx-state-tree').IModelType<
  {
    loggedInUser: import('mobx-state-tree').ISimpleType<string>;
    selectedTheme: import('mobx-state-tree').ISimpleType<string>;
    tagSortOrder: import('mobx-state-tree').ISimpleType<string>;
  },
  {
    setLoggedInUser(handle: string): void;
    setSelectedTheme(theme: string): void;
    setTagSortOrder(order: string): void;
  },
  import('mobx-state-tree')._NotCustomized,
  import('mobx-state-tree')._NotCustomized
>;
export interface IAppStateStoreModel
  extends Instance<typeof AppStateStoreModel> {}
declare let store: IAppStateStoreModel;
export default store;
