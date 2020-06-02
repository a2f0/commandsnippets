import React, { useState, useEffect } from 'react'
import { useDrop } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
import API from './api.js'

const width = {
  width: "100%",
}

const EntryList = React.memo(function EntryList(props) {

  useEffect(() => {
    const fetchData = async () => {
      const response = await API.get('/tags_entries');
      setIncluded(response.data.included);
      setEntries(response.data.data);
    }
    fetchData();
  }, []);

  const [entries, setEntries] = useState([])
  const [included, setIncluded] = useState([])
  const moveEntry = (id, atIndex) => {
    const { entry, index } = findEntry(id)
    setEntries(
      update(entries, {
        $splice: [
          [index, 1],
          [atIndex, 0, entry],
        ],
      }),
    )
  }
  const findEntry = (id) => {
    const entry = entries.filter((c) => `${c.id}` === id)[0]
    return {
      entry,
      index: entries.indexOf(entry),
    }
  }
  const [, drop] = useDrop({ accept: ItemTypes.ENTRY })

  return (

    <div ref={drop} style={width}>
      {entries.map((entry, i) => {

        const text_entry = included.filter(
          i => i.type=="TextEntry" && i.id == entry.relationships.text_entry.data.id
        )[0];

        const tag = included.filter(
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
})
export default EntryList
