import React, { useState, useEffect, useContext } from 'react'
import { useDrop } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
import API from './api.js'
import { autorun } from 'mobx'
import AppContext from './AppContext.js'
import { observer } from "mobx-react"
import { useLocation, useParams } from 'react-router-dom';
import UntaggedEntry from './UntaggedEntry.jsx'

const width = {
  width: "100%",
}

const UntaggedEntryList = React.memo(observer(function EntryList(props) {

  const appConfig = useContext(AppContext)
  const [data, setData] = useState( { data: [], included: [] })
  const location = useLocation()
  const { user } = useParams();
  const { tag } = useParams();

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [location],
  )

  const retrieveEntries = () => {
    const fetchData = async () => {
      var url_query_query_string = '/entries?' +
        'sort=' + appConfig.entrySortOrder +
        '&filter[tag_count]=0' +
        '&filter[is_deleted]=False'
      const response = await API.get(
        url_query_query_string
      );
      setData(response.data);
    }
    fetchData();
  }

  return (

    <div style={width}>
      {data.data.map((entry, i) => {

        return (
          <UntaggedEntry
            key={entry.id}
            id={entry.id}
            entry={entry}
            retrieveEntries={retrieveEntries}
          />
        ) 
      })
      }
    </div>

  )
}))
export default UntaggedEntryList
