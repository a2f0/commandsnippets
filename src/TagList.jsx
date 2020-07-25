import React, {useEffect, useState, useContext} from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import Tag from './Tag.jsx'
import TagSearch from './Search.jsx'
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import memoize from "memoize-one";
import { makeStyles } from '@material-ui/core/styles';
import API from './api.js'
import TagNew from './TagNew.jsx'
import AppContext from './AppContext.js'
import {observer} from 'mobx-react';

const useStyles = makeStyles({
  root: {
    paddingTop: 2,
    paddingBottom: 0,
    paddingLeft: 10,
    paddingRight: 0
  },
  item: {
    padding: 0,
    minWidth: 0,
    width: 'inherit',
    display: 'inline-block'
  }
});

const TagList = React.memo(observer(function TagList(props) {

  const appConfig = useContext(AppContext)
  const [data, setData] = useState( { data: [], included: [] });
  const [sort, setSort] = useState('name');
  
  useEffect(() => {
    const fetchData = async () => {
      const sort_string = '?sort=' + sort
      const response = await API.get('/tags' + sort_string);
      setData(response.data);
    }
    fetchData();
  }, []);

  const getSortedTags = (sort) => {
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
  };

  const handleNavigateToUntaggedEntries = () => {
    appConfig.mainPanel = 'UntaggedEntryList'
  }

  const classes = useStyles();
  return (
    <>
      <TagSearch/>
      <List className={classes.root}>
        {/* <TagNew/> */}
        {data.data.map((tag, i) => {
          const user = data.included.filter(
            i => i.type=="User" && i.id == tag.relationships.user.data.id
          )[0];
          return (
            <div key={tag.id} className={classes.container}>
              <ListItem  className={classes.item} button>
                <Tag id={tag.id} tag={tag} user={user}/>
              </ListItem>
            </div>
          )
        })}
        <ListItem className={classes.item} button>
          <div onClick={handleNavigateToUntaggedEntries}>Untagged Entries</div>
        </ListItem>
      </List>
    </>
  )
}))
export default TagList