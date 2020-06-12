import React, { useState, useEffect, useContext } from 'react'
import { useDrop } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
import API from './api.js'
import { autorun } from 'mobx'
import AppContext from './AppContext.js'
import { observer } from "mobx-react"

const width = {
  width: "100%",
}

const EntryList = React.memo(observer(function EntryList(props) {

  const appConfig = useContext(AppContext)
  const [data, setData] = useState( { data: [], included: [] })

  useEffect(
    () =>
      autorun(() => {
        const fetchData = async () => {
          const response = await API.get(
            '/tags_entries?' +
            'sort=' + appConfig.entrySortOrder
          );
          setData(response.data);
        }
        fetchData();
      }),
    [],
  )
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
  const [, drop] = useDrop({ accept: ItemTypes.ENTRY })

  return (

    <div ref={drop} style={width}>
      {data.data.map((entry, i) => {

        const text_entry = data.included.filter(
          i => i.type=="TextEntry" && i.id == entry.relationships.text_entry.data.id
        )[0];

        const tag = data.included.filter(
          i => i.type==="Tag" && i.id == entry.relationships.tag.data.id
        )[0];

        return (
          <Entry
            key={entry.id}
            id={entry.id}
            index={i}
            subject={text_entry.attributes.subject}
            body={text_entry.attributes.body}
            moveEntry={moveEntry}
            findEntry={findEntry}
          />
        ) 
      })
      }
    </div>

  )
}))
export default EntryList
