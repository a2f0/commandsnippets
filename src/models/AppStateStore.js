import { types } from "mobx-state-tree"

const AppStateStore = types.model({
  loggedInUser: types.string,
  selectedTheme: types.string
})
  .actions((self) => ({
    setLoggedInUser(handle) {
      self.loggedInUser = handle
    },
    setSelectedTheme(theme) {
      self.selectedTheme = theme
    }
  }))
export default AppStateStore