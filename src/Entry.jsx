import React, { useRef, useState, useMemo, useEffect } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import { useTheme } from '@material-ui/styles';
import API from './api.js'
import { makeStyles } from '@material-ui/core/styles';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import EntryContextMenu from './EntryContextMenu.jsx'
import EntryEdit from './EntryEdit.jsx';
import EntryNew from './EntryNew.jsx'


const useStyles = makeStyles({

  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    marginBottom: 16,
    // "&:hover": {
    //   color: "white"
    // },
    // "&:active": {
    //   color: "white"
    // },
  },
  entrySubject: {

  },
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  }
});

const Entry = React.memo(function ({ id, index, moveEntry, findEntry, handleDelete, text_entry, newEntry, tag }) {

  useEffect(() => {
    setTextEntry(text_entry);
  }, [text_entry]);

  const [showNew, setShowNew] = useState(false)
  const [textEntry, setTextEntry] = useState()
  const dragRef = useRef(null)
  const dropRef = useRef(null)
  const originalIndex = findEntry(id).index
  const [showDragHandle, setShowDragHandle] = useState(false)
  const classes = useStyles();
  const theme = useTheme();
  const [{ isDragging }, drag, preview] = useDrag({
    item: { type: ItemTypes.ENTRY, id, originalIndex },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      const drop_result = monitor.getDropResult()
      const { id: droppedId, originalIndex } = monitor.getItem()
      const didDrop = monitor.didDrop()
      if (!didDrop) {
        moveEntry(droppedId, originalIndex)
      } else {
        if ( "type" in drop_result ) {
          if ( drop_result.type === "Tag" ) {
            const payload = {
              'data': {
                'type': 'TagTextEntryThroughModel',
                'attributes': {},
                'relationships': {
                  'tag': {
                    'data': {
                      'type': 'Tag', 
                      'id': drop_result.id 
                    }
                  },
                  'text_entry': {
                    'data': {
                      'type': 'TextEntry',
                      'id': findEntry(id).entry.relationships.text_entry.data.id
                    }
                  }
                }
              }
            }
            const response = API.post('tags_entries', payload,  {withCredentials: true});
          }
        } else {
          // Then it was reordered in the list.
          if (originalIndex != findEntry(id).index ) {
            console.info("it moved from index " + originalIndex + " to " + findEntry(id).index)
          } else {
            console.info("it wasn't moved.")
          }
        }
      }
    },
  })
  // Make sure opacity is above the useDrag call above
  const opacity = isDragging ? 0 : 1
  const [, drop] = useDrop({
    accept: ItemTypes.ENTRY,
    canDrop: () => {
    },
    hover(item, monitor) {
      if (!dragRef.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) {
        return
      }
      // Determine rectangle on screen
      const hoverBoundingRect = dragRef.current?.getBoundingClientRect()
      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      // Determine mouse position
      const clientOffset = monitor.getClientOffset()
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      moveEntry(item.id, hoverIndex)
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  drag(dragRef)
  drop(dropRef)

  const mouseEnter = () => {
    setShowDragHandle(true)
  }
  const mouseLeave = () => {
    setShowDragHandle(false)
  }

  const initialMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);
  const [isEditing, setIsEditing] = useState(false);

  const handleBeginEdit = () => {
    setIsEditing(true)
  };

  const handleCancelEdit = () => {
    setIsEditing(false)
  };

  const handleSave = (updated_subject, updated_body) => {
    const payload = {
      'data': {
        'id': text_entry.id,
        'type': 'TextEntry',
        'attributes': {
          'subject': updated_subject,
          'body': updated_body,
        }
      }
    }
    const response = API.patch('entries/' + text_entry.id, payload,  {withCredentials: true});
    let new_text_entry = {...textEntry}
    new_text_entry.attributes.subject = updated_subject
    new_text_entry.attributes.body = updated_body
    setTextEntry(new_text_entry)
    setIsEditing(false)
  };

  const handleContextClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    let mouseData = {...mouse}
    mouseData.mouseX = event.clientX - 2,
    mouseData.mouseY = event.clientY - 4,
    setMouse(mouseData)
  };

  const handleNewEntry = () => {
    setShowNew(true)
  };

  const contextMenu = useMemo(() => 
    <EntryContextMenu 
      mouse={mouse} 
      id={id}
      handleDelete={handleDelete}
      handleNewEntry={handleNewEntry}
      handleBeginEdit={handleBeginEdit}/>, [mouse]);
  
  return (
    <>
      { ! isEditing && (
        <div ref={(dropRef)} style={{opacity}} onContextMenu={handleContextClick}> 
          <div ref={(preview)} className={classes.entryWrapper}>
            <div
              ref={(dragRef)} 
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
                {text_entry.attributes.subject}
              </div>
              <div className={classes.entryBody}>
                {text_entry.attributes.body}
              </div>
            </div>
          </div>
        </div>
      )}

      { showNew && (
        <EntryNew
          tag={tag} 
          classes={classes}/>
      )}

      {contextMenu}
      
      { isEditing && (
        <EntryEdit 
          classes={classes} 
          subject={text_entry.attributes.subject} 
          body={text_entry.attributes.body}
          handleSave={handleSave}
          handleCancelEdit={handleCancelEdit}/>
      )}
    </>
  )
})
export default Entry
