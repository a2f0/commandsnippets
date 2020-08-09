import { types } from "mobx-state-tree"

const AppStateStore = types.model({
  loggedInUser: types.string,
})
  .actions((self) => ({
    setLoggedInUser(handle) {
      self.loggedInUser = handle
    }
  }))
export default AppStateStore