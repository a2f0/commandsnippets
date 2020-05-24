import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import memoize from "memoize-one";
import observableUser from './user.js';
import constructApiUrl from './api.js';
import NewEntry from './NewEntry.jsx';

import CssBaseline from '@material-ui/core/CssBaseline';
import Typography from '@material-ui/core/Typography';

import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Button from '@material-ui/core/Button';

import Drawer from '@material-ui/core/Drawer';
import List from '@material-ui/core/List';
import Divider from '@material-ui/core/Divider';
import ListItem from '@material-ui/core/ListItem';


import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Fade from '@material-ui/core/Fade';

import Link from '@material-ui/core/Link';

import { withStyles } from '@material-ui/core/styles';

// DND
import { DndProvider } from 'react-dnd'
import Backend from 'react-dnd-html5-backend'

import EntryList from './EntryList.jsx'

import style from './style.js'

import './style/border-px.less';
import './style/entries.less';
import './style/tearleads.less';
import './style/taglist.less';
import './style/create-entry.less';
import './style/login.less';

//
import Tag from './Tag.jsx'

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
      const base_url = constructApiUrl();
      var url = base_url + '/api/v1/tags';
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

const StyledMenu = withStyles({
  paper: {
    border: '0px solid #d3d4d5',
    borderRadius: 0,
    margin: 0
  },
  list: {
    padding: 0
  }
})((props) => (
  <Menu
    getContentAnchorEl={null}
    anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
    transformOrigin={{ vertical: "top", horizontal: "left" }}
    keepMounted
    elevation={0}
    getContentAnchorEl={null}
    {...props}
  />
));


function AppRouter() {
  const classes = style();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <React.StrictMode>
      <Router>
        <DndProvider backend={Backend}>
          <div className={classes.root}>
            <CssBaseline />
            <AppBar position="fixed" className={classes.appBar}>
              <Toolbar variant="dense" className={classes.toolBar}>
                {/* <IconButton edge="start" className={classes.menuButton} color="inherit" aria-label="menu">
             <MenuIcon />
           </IconButton> */}
                <Typography className={classes.title}>
                </Typography>
                <Button size="small" color="inherit" className={classes.button}>Login</Button>
              </Toolbar>
              <Toolbar variant="dense" className={classes.toolBar}>
                <Typography className={classes.drawer}>
                </Typography>
                <Button size="small" color="inherit" label="Primary" aria-controls="file-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
            File
                </Button>
                <Button size="small" color="inherit" label="Primary" aria-controls="edit-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
            Edit
                </Button>

                <Button size="small" color="inherit" label="Primary" aria-controls="view-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
            View
                </Button>
                <Button size="small" color="inherit" label="Primary" aria-controls="help-menu" className={classes.menuButton} aria-haspopup="true" onClick={handleClick}>
            Help
                </Button>
              </Toolbar>
              <StyledMenu
                id="file-menu"
                className={classes.menu}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                TransitionComponent={Fade}
              >
                <MenuItem className={classes.menuItem} onClick={handleClose}>Profile</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>My account</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>Logout</MenuItem>
              </StyledMenu>
              <StyledMenu
                id="edit-menu"
                className={classes.menu}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                TransitionComponent={Fade}
              >
                <MenuItem className={classes.menuItem} onClick={handleClose}>Edit 1</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>Edit 2</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>Edit 3</MenuItem>
              </StyledMenu>
              <StyledMenu
                id="view-menu"
                className={classes.menu}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                TransitionComponent={Fade}
              >
                <MenuItem className={classes.menuItem} onClick={handleClose}>View 1</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>View 2</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>View 3</MenuItem>
              </StyledMenu>
              <StyledMenu
                id="help-menu"
                className={classes.menu}
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                TransitionComponent={Fade}
              >
                <MenuItem className={classes.menuItem} onClick={handleClose}>Help 1</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>Help 2</MenuItem>
                <MenuItem className={classes.menuItem} onClick={handleClose}>Help 3</MenuItem>
              </StyledMenu>
            
            </AppBar>
            <Drawer
              className={classes.drawer}
              variant="permanent"
              classes={{
                paper: classes.drawerPaper,
              }}
            >
              <Toolbar variant="dense" className={classes.toolBar}/>
              <Toolbar variant="dense" className={classes.toolBar}/>
              <Toolbar variant="dense" className={classes.toolBar}/>
              <div className={classes.drawerContainer}>
                <Divider/>
                <List>
                  <ListItem button>
                    <Tag id='233' name='docker'/>
                  </ListItem>
                  <ListItem button>
                    <Tag id='133' name='aws'/>
                  </ListItem>
                </List>
              </div>
            </Drawer>
            <main className={classes.content}>
              <Toolbar variant="dense" className={classes.toolBar} />
              <Toolbar variant="dense" className={classes.toolBar}/>
              <Toolbar variant="dense" className={classes.toolBar}/>
              <EntryList/>
            </main>
          </div>
        </DndProvider>
      </Router>
    </React.StrictMode>
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));
