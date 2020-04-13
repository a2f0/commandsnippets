import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Link } from "react-router-dom";
import memoize from "memoize-one";
import './style/border-px.less';
import './style/entries.less';
import './style/tearleads.less';
import './style/taglist.less';

class Index extends React.Component { 

  constructor(props) {
    super(props);
    this.state = {
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
    fetch('http://localhost:8000/api/v1/tags?sort=name')
      .then(res => res.json())
      .then((res) => {
        this.setState({ tags: res })
      })
      .catch(console.log)
  }

  // Re-run the filter whenever the user or tag changes.
  filter = memoize(
    (user, tag) => {
      var url = 'http://localhost:8000/api/v1/entries'
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

  render() {
    const { user } = this.props.match.params
    const { tag } = this.props.match.params
    this.filter(user, tag);
    return (
      <div className="flex-container-entries">
        <div  className= "flex-taglist">
          {/* <div className="taglist-header">Tag List</div> */}
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
    );
  }
}


function NavigationTop() {
  return (
    <div className="navbar navbar-top">
      <div className="flex-container">
        <div className="flex-max-width">
          <div className="flex-container">
            <div className="flex">
              <div className="flex-container-left">
                <div className="menu-item inline-block">
                  <Link to="/">Tearleads</Link>
                </div>
              </div>
            </div>
            <div className="flex">
              <div className="flex-container-right">
                <div className="inline-block menu-item menu-item-spacing">
                  {/* <Link to="/login">Login</Link> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavigationBottom() {
  return (
    <div className="navbar navbar-bottom">
      <div className="flex-container">
        <div className="flex-max-width">
          <div className="flex-container">
            <div className="flex">
              <div className="flex-container-left">
                <div className="inline-block menu-item">
                  {/* <Link to="/">Tearleads</Link> */}
                </div>
              </div>
            </div>
            <div className="flex">
              <div className="flex-container">
                <div className="inline-block menu-item">
                  {/* <Link to="/">Index</Link> */}
                </div>
              </div>
            </div>
            <div className="flex">
              <div className="flex-container-right">
                <div className="inline-block menu-item">
                  {/* <Link to="/">Search</Link> */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppRouter() {
  return (
    <Router>
      <NavigationTop />
      <div className="flex-container">
        <div className="flex-max-width">
          <Route exact path="/"  component={Index} />
          <Route path="/:user/:tag" component={Index} />
        </div>
      </div>
      <NavigationBottom />
    </Router>
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));
