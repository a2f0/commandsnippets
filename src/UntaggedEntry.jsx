import React, { useState, useEffect, useContext } from 'react'
import { useDrop, useDrag } from 'react-dnd'
import Entry from './Entry.jsx'
import update from 'immutability-helper'
import ItemTypes from './ItemTypes'
import API from './api.js'
import { autorun } from 'mobx'
import AppContext from './AppContext.js'
import { observer } from "mobx-react"
import { useLocation, useParams } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import { useTheme } from '@material-ui/styles';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';

// const style = {
//   border: '1px dashed gray',
//   backgroundColor: 'white',
//   padding: '0.5rem 1rem',
//   marginRight: '1.5rem',
//   marginBottom: '1.5rem',
//   cursor: 'move',
//   float: 'left',
// }

const width = {
  width: "100%",
}

const useStyles = makeStyles({

  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    marginBottom: 16,
  },
  entrySubject: {

  },
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  }
});


const UntaggedEntryList = React.memo(observer(function EntryList(props) {

  const [showDragHandle, setShowDragHandle] = useState(false)
  const classes = useStyles();
  const theme = useTheme();

  const mouseEnter = () => {
    setShowDragHandle(true)
  }
  const mouseLeave = () => {
    setShowDragHandle(false)
  }

  const [{ isDragging }, drag] = useDrag({
    item: { name, type: ItemTypes.UNTAGGEDENTRY },
    end: (item, monitor) => {
      const dropResult = monitor.getDropResult()
      if (item && dropResult) {
        console.info("it was dropped")
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })
  const opacity = isDragging ? 0 : 1

  return (
    <div  className={classes.entryWrapper} ref={drag} style={{ opacity }}>
      <div
        style={{...theme.custom.dragIndicator}}
        onMouseEnter={mouseEnter} 
        onMouseLeave={mouseLeave}>
        <DragIndicatorIcon
          style={{ visibility: showDragHandle ? "visible" : "hidden" }}
        />
      </div>
      <div className={classes.entry}
        onMouseEnter={mouseEnter}
        onMouseLeave={mouseLeave}>
        <div className={classes.entrySubject}>
          {props.entry.attributes.subject}
        </div>
        <div className={classes.entryBody}>
          {props.entry.attributes.body}
        </div>
      </div>
    </div>

  )
}))
export default UntaggedEntryList
