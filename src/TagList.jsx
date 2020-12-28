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
import { autorun } from 'mobx'
import TagNew from './TagNew.jsx'
import AppContext from './AppContext.js'
import {observer} from 'mobx-react';
import { useParams, useHistory } from 'react-router-dom';
import * as Constants from './constants'
import update from 'immutability-helper'


const useStyles = makeStyles({
  root: {
    paddingTop: 2,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    overflowY: "auto",
    direction: "rtl",
    height: `calc(100vh - ${Constants.appBarHeight}px)`
  },
  ltr: {
    direction: "ltr"
  },
  item: {
    display: 'inline-block',
    marginLeft: `${Constants.dragIndicatorWidthTag}px`
  }
});

const TagList = React.memo(observer(function TagList(props) {

  const appConfig = useContext(AppContext)
  const [data, setData] = useState( { data: [], included: [] });
  const [sort, setSort] = useState('name');
  const { user } = useParams();
  const history = useHistory();

  useEffect(
    () =>
      autorun(() => {
        fetchTags();
      }),
    [location],
  )

  async function fetchTags() {
    let data = [];
    let included = [];
    let nextPage = null;
    let page = 0;

    do {
      let { data: response }  = await API.get('/tags', { params: { 'page[number]': ++page, sort: appConfig.tagSortOrder } });
      nextPage = response.links.next
      data = data.concat(response.data);
      included = data.concat(response.included);
    } while (nextPage != null) 
    setData({ data: data, included: included});
  }

  const handleNavigateToUntaggedEntries = () => {
    // untagged-entries
    history.push(`/${user}/untagged-entries`);
    appConfig.mainPanel = 'UntaggedEntryList'
  }

  const classes = useStyles();

  const moveEntry = (id, atIndex) => {
    const { entry, index } = findEntry(id)
    let reordered = update(data.data, {
      $splice: [
        [index, 1],
        [atIndex, 0, entry],
      ],
    }) 
    let newData = {...data, data: reordered }
    setData(newData)
  }
  
  const findEntry = (id) => {
    const entry = data.data.filter((c) => `${c.id}` === id)[0]
    return {
      entry,
      index: data.data.indexOf(entry),
    }
  }

  const findEntryByIndex = (index) => {
    if (index > data.data.length - 1) {
      return null;
    } else {
      return data.data[index];
    }
  }

  return (
    <>
      { appConfig.tagSearch && (
        <TagSearch/>
      )}
      <List className={classes.root}>
        <div  className={classes.ltr}>
          { appConfig.tagNew && (
            <TagNew fetchTags={fetchTags}/>
          )}
          {data.data.map((tag, i) => {
            const user = data.included.filter(
              i => i.type=="User" && i.id == tag.relationships.user.data.id
            )[0];
            return (
              <div key={tag.id}>
                <Tag id={tag.id} tag={tag} user={user} fetchTags={fetchTags} moveEntry={moveEntry} findEntry={findEntry} index={i} findEntryByIndex={findEntryByIndex}/>
              </div>
            )
          })}
          <div className={classes.item}>
            <div onClick={handleNavigateToUntaggedEntries}>untagged</div>
          </div>
        </div>
      </List>
    </>
  )
}))
export default TagList