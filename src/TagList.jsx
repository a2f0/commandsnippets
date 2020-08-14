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
import { useParams, useHistory } from 'react-router-dom';

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
  const { user } = useParams();
  const history = useHistory();
  
  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = () => {
    const sort_string = '?sort=' + sort
    API.get('/tags' + sort_string)
      .then(function (response) {
        // success
        setData(response.data);
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      }); 
  }

  const handleNavigateToUntaggedEntries = () => {
    // untagged-entries
    history.push(`/${user}/untagged-entries`);
    appConfig.mainPanel = 'UntaggedEntryList'
  }

  const classes = useStyles();
  return (
    <>
      { appConfig.tagSearch && (
        <TagSearch/>
      )}
      <List className={classes.root}>
        { appConfig.tagNew && (
          <TagNew fetchTags={fetchTags}/>
        )}
        {data.data.map((tag, i) => {
          const user = data.included.filter(
            i => i.type=="User" && i.id == tag.relationships.user.data.id
          )[0];
          return (
            <div key={tag.id} className={classes.container}>
              <ListItem  className={classes.item} button>
                <Tag id={tag.id} tag={tag} user={user} fetchTags={fetchTags}/>
              </ListItem>
            </div>
          )
        })}
        <ListItem className={classes.item} button>
          <div onClick={handleNavigateToUntaggedEntries}>untagged entries</div>
        </ListItem>
      </List>
    </>
  )
}))
export default TagList