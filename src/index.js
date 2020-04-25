import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Link, Switch } from "react-router-dom";
import memoize from "memoize-one";
import './style/border-px.less';
import './style/entries.less';
import './style/tearleads.less';
import './style/taglist.less';

class Index extends React.Component { 

  constructor(props) {
    super(props);
    this.state = {
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

  // Re-run the filter whenever the user or tag changes.
  getEntries = memoize(
    (user, tag) => {
      var url = 'http://localhost:9001/api/v1/entries'
      var querystring='?';
      if (tag != undefined) {
        querystring = querystring + 'filter[tags.name]=' + tag
      }
      if (querystring != '?') {
        url = url + querystring
      }
      fetch(url)
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
      fetch(url)
        .then(res => res.json())
        .then((res) => {
          this.setState({ tags: res })
        })
        .catch(console.log)
    }
  );

  render() {
    const { user } = this.props.match.params
    const { tag } = this.props.match.params
    this.getEntries(user, tag);
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


function NavigationTop() {
  return (
    <div className="navbar navbar-top">
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
                <Link to="/">Menu 2</Link>
              </div>
              <div className="inline-block menu-item menu-item-spacing">
                <Link to="/">Menu 1</Link>
              </div>

              
            </div>
          </div>
        </div>
        <div className="flex-side-column"></div>
      </div>
    </div>
  )
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
          <Route path="/:user/:tag" component={Index} />
          <Route exact path="/"  component={Index} />
        </Switch>
        <div className="flex-side-column"></div>
      </div>
      <NavigationBottom />
    </Router>
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));
