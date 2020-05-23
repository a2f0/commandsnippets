import React, { useState, useEffect } from 'react'
import { useDrop } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
import API from './api.js'
const style = {
  width: "100%",
}
const ITEMS = [
  {
    type: "TextEntry",
    id: 24,
    attributes: {
      body: "aws rds describe-pending-maintenance-actions",
      subject: "show pendings aws maintenance actions",
      date_updated: "2019-03-17T18:20:00",
      date_created: "2019-03-17T18:20:00"
    }
  },
  {
    type: "TextEntry",
    id: 25,
    attributes: {
      body: "aws rds describe-db-instances",
      subject: "show detail about RDS instances",
      date_updated: "2019-03-17T18:20:00",
      date_created: "2019-03-17T18:20:00"
    }
  }
]

const EntryList = () => {

  useEffect(() => {
    const fetchData = async () => {
      const response = await API.get('/tags_entries');
    	setEntries(response.data.data);
    }
    fetchData();
  }, []);

  const [entries, setEntries] = useState([])
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
    <>
      <div ref={drop} style={style}>
        {entries.map((entry) => (
          <Entry
            key={entry.id}
            id={`${entry.id}`}
            subject={entry.attributes.subject}
            body={entry.attributes.body}
            moveEntry={moveEntry}
            findEntry={findEntry}
          />
        ))}
      </div>
    </>
  )
}
export default EntryList
