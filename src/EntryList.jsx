import React, { useState } from 'react'
import { useDrop } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
const style = {
  width: 400,
}
const ITEMS = [
  {
    id: 1,
    text: 'Entry1',
  },
  {
    id: 2,
    text: 'Entry 2',
  },
  {
    id: 3,
    text: 'Entry 3',
  },
  {
    id: 4,
    text: 'Entry 4',
  }
]
const EntryList = () => {
  const [entries, setEntries] = useState(ITEMS)
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
            text={entry.text}
            moveEntry={moveEntry}
            findEntry={findEntry}
          />
        ))}
      </div>
    </>
  )
}
export default EntryList
