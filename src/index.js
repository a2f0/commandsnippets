import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Link, Switch } from "react-router-dom";
import memoize from "memoize-one";
import observableUser from './user.js';
import Login from './Login.jsx';
import NavigationTop from './NavigationTop.jsx';

import './style/border-px.less';
import './style/entries.less';
import './style/tearleads.less';
import './style/taglist.less';
import './style/create-entry.less';
import './style/login.less';

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
      if (querystring == undefined) {
        var url = 'http://127.0.0.1:9001/api/v1/entries'
      } else {
        var url = 'http://127.0.0.1:9001/api/v1/entries?' + querystring
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

  getSortedTags(sort) {
    if (sort === this.state.tagSort) {
      // Then the sort attribute stayed the same, reverse the order.
      if (this.state.tagDescending === false) {
        sort = '-' + sort
      }
      this.setState({ tagDescending: !this.state.tagDescending })
    } else {
      // Then the sort attribute changed.
      this.setState({ tagSort: sort })
      // When sorting tags by created, the most recent should be on top.
      if (sort === 'date_created') {
        sort = '-' + sort
        this.setState({ tagDescending: true })
      } else {
        // Reset the sort order to ascending.
        this.setState({ tagDescending: false })
      }
    }
    this.getTags(sort);
  }

  getTags = memoize(
    (sort) => {
      var url = 'http://localhost:9001/api/v1/tags'
      var querystring = "?"
      if (sort != undefined) {
        querystring = querystring + 'sort=' + sort
      } else {
        querystring = querystring + 'sort=name'
      }

      if (querystring != '?') {
        url = url + querystring
      }
      fetch(url, {
        method: 'GET',
        credentials: 'include'
      })
        .then(res => res.json())
        .then((res) => {
          this.setState({ tags: res })
        })
        .catch(console.log)
    }
  );

  newEntry( ) {
    this.setState({ showNewEntry: !this.state.showNewEntry });
    console.log(this.state.showNewEntry);
  }

  saveEntry( ) {
    console.log("saveEntry");
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
              <div className="inline-block" onClick={() => this.newEntry()}>[new]</div>
            </div>

            {showNewEntry && (
              <div>
                <div>
                  <input type="text" id="subject" name="subject"></input>
                </div>
                <div>
                  <input type="text" id="body" name="body"></input>
                </div>
                <div>
                  <div className="create-entry-button" onClick={() => this.saveEntry()}>
                  Save
                  </div>
                  <div className="create-entry-button" onClick={() => this.newEntry()}>
                  Cancel
                  </div>
                </div>
              </div>
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

function AppRouter() {
  return (
    <Router>
      <NavigationTop />
      <div className="flex-main-container flex-main-container-margin">
        <div className="flex-side-column"></div>
        <Switch>
          <Route exact path="/login" render={(props) => <Login {...props} user={observableUser} />} />
          <Route path="/:user/:tag" component={Index} />
          <Route path="/:user" component={Index} />
          <Route exact path="/" component={Index} />
        </Switch>
        <div className="flex-side-column"></div>
      </div>
      <NavigationBottom />
    </Router>
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));
