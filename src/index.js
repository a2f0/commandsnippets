import React, { useState} from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import constructApiUrl from './api.js';
import CssBaseline from '@material-ui/core/CssBaseline';
import { makeStyles, MuiThemeProvider } from '@material-ui/core/styles';
import Link from '@material-ui/core/Link';
import { DndProvider } from 'react-dnd'
import Backend from 'react-dnd-html5-backend'
import {lightTheme } from './themes.js'
import { observable } from "mobx"
import AppContext from './AppContext.js'
import Main from './Main.jsx'
import Login from './Login.jsx'

class Index extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      entryDescending: true,
      entrySort: 'date_updated',
      showNewEntry: false,
      tagDescending: false,
      tagSort: 'name',
      tagDescending: false,
      entries: {
        data: [],
        included: []
      },
      tags: {
        data: []
      }
    };
  }

  componentDidMount() {
    console.info('componentDidMount')
    this.getTags();
  }

  getSortedEntries(sort) {
    if (sort === this.state.entrySort) {
      // Then the sort attribute stayed the same, invert the order.
      this.setState({ entryDescending: !this.state.entryDescending })
    } else {
      this.setState({ entrySort: sort })
    }
  }

  getEntries() {
    const { user } = this.props.match.params
    const { tag } = this.props.match.params
    var query_params = [];
    if (tag != undefined) {
      query_params.push('filter[tags.name]=' + tag)
    }
    if (this.state.entrySort != undefined) {
      var sort = this.state.entrySort
      if (this.state.entryDescending === false) {
        sort = '-' + this.state.entrySort
      }
      query_params.push('sort=' + sort)
    }
    var querystring = undefined;
    if (query_params.length > 0) {
      querystring = query_params.join('&')
    }
    this.memoizeEntries(querystring)
  }

  // Re-run the filter whenever the user or tag changes.
  memoizeEntries = memoize(
    (querystring) => {
      const base_url = constructApiUrl();
      if (querystring == undefined) {
        var url = base_url + '/api/v1/entries';
      } else {
        var url = base_url + '/api/v1/entries?' + querystring;
      }
      fetch(url, {
        method: 'GET',
        credentials: 'include'
      })
        .then(res => res.json())
        .then((res) => {
          this.setState({ entries: res })
        })
        .catch(console.log);
    }
  );

  showNewEntry = () => {
    this.setState({ showNewEntry: !this.state.showNewEntry });
  }

  render() {
    this.getEntries();
    const { showNewEntry } = this.state;
    return (
      <div className="flex-center-column">
        <div className="flex">
          <div className="flex-taglist">
            <div className="taglist-entry">
              <div className="inline-block" onClick={() => this.getSortedTags('name')}>[a-z]</div>
              <div className="inline-block" onClick={() => this.getSortedTags('date_created')}>[created]</div>
            </div>
            {this.state.tags.data.map(tag => {
              const user = this.state.tags.included.filter(
                i => i.type==="User" && i.id == tag.relationships.user.data.id
              )[0];
              return (
                <div key={tag.id} className="taglist-entry">
                  <Link to={`/${user.attributes.username}/${tag.attributes.name}`}>{tag.attributes.name}</Link>
                </div>
              )
            })
            }
            <div className="taglist-entry">
              <Link to={`/`}>all entries</Link>
            </div>
            <div className="taglist-entry">
              <Link to={`/`}>untagged entries</Link>
            </div>
            <div className="taglist-entry">
              <Link to={`/`}>deleted entries</Link>
            </div>
          </div>
          <div>
            <div className="taglist-entry">
              <div className="inline-block" onClick={() => this.getSortedEntries('subject')}>[a-z subject]</div>
              <div className="inline-block" onClick={() => this.getSortedEntries('body')}>[a-z body]</div>
              <div className="inline-block" onClick={() => this.getSortedEntries('date_created')}>[created]</div>
              <div className="inline-block" onClick={() => this.getSortedEntries('date_updated')}>[updated]</div>
              { observableUser.userName != '' && (
                <div className="inline-block" onClick={() => this.showNewEntry()}>[new]</div>
              )
              }
            </div>
            {showNewEntry && (
              <NewEntry parentShowNewEntry={this.showNewEntry}/>
            )}
            {this.state.entries.data.map(entry => (
              <div key={entry.id}>
                <div className="entry-subject">
                  { entry.attributes.subject }
                </div>
                <div className="entry-body">
                  { entry.attributes.body }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

function NavigationBottom() {
  return (
    <div className="navbar navbar-bottom">
      <div className="flex-main-container">
        <div className="flex-side-column"></div>
        <div className="flex-center-column">
          <div className="flex">
            <div className="flex-align-left">
              <div className="menu-item inline-block">
                <Link to="/">Tearleads</Link>
              </div>
            </div>
            <div className="flex-align-right">
              <div className="inline-block menu-item menu-item-spacing">
                <Link to="/">Tearleads</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-side-column"></div>
      </div>
    </div>
  )
}

const appBarHeight = 52;

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },


}));

const appConfig = observable({
  entrySortOrder: 'date_created',
  authenticatedUser: null,
  loggedInUser: null,
  mainPanel: 'EntryList'
})

function AppRouter() {
  const classes = useStyles();
  const [selectedTheme, setSelectedTheme] = useState(lightTheme);
  const handleThemeSwitcher = (chosenTheme) => {
    setSelectedTheme(chosenTheme)
  }
  return (
    <Router>
      <AppContext.Provider value={appConfig}>
        <MuiThemeProvider theme={selectedTheme}>
          <CssBaseline />
          <DndProvider backend={Backend}>
            <div className={classes.root}>
              <Switch>
                <Route path="/login">
                  <Login/>
                </Route>
                <Route path="/:user/:tag">
                  <Main handleThemeSwitcher={handleThemeSwitcher}/>
                </Route>
                <Route path="/:user">
                  <Main handleThemeSwitcher={handleThemeSwitcher}/>
                </Route>
                <Route exact path="/">
                  <Main handleThemeSwitcher={handleThemeSwitcher}/>
                </Route>
              </Switch>
            </div>    
          </DndProvider>
        </MuiThemeProvider>
      </AppContext.Provider>
    </Router>
    
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));