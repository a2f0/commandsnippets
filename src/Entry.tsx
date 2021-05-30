import * as React from 'react';
import {useRef, useState, useMemo, useEffect} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import ItemTypes from './ItemTypes';
import API from './api';
import {makeStyles} from '@material-ui/core/styles';
import {useAppContext} from './AppContext';
import * as Constants from './constants';
import EntryNew from './EntryNew.jsx';
import EntryEdit from './EntryEdit';
import EntryContextMenu from './EntryContextMenu';
import {TagTextEntryThroughModel} from './EntryList';
const useStyles = makeStyles({
  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryContainer: {
    marginBottom: 16,
    whiteSpace: 'pre',
  },
  entrySubject: {},
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  },
  dragIndicatorContainer: {
    display: 'inline-block',
    fontWeight: 900,
    textAlign: 'center',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
  dragIndicator: {
    cursor: 'grab',
  },
  reuseCount: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
});

export interface ITag {
  id: number;
  type: string;
  attributes: {};
  data: {};
}

export interface ITextEntry {
  id: number;
  type: string;
  attributes: {
    reused_count: number;
    subject: string;
    body: string;
  };
  data: {
    id: number;
  };
}

export interface IMouse {
  mouseX: number | null;
  mouseY: number | null;
}

interface IEntryProps {
  id: number;
  index: number;
  moveEntry: (id: number, to: number) => void;
  findEntry: (id: number) => {entry: TagTextEntryThroughModel; index: number};
  handleDelete: (id: number) => void;
  text_entry: ITextEntry;
  tag: ITag;
  retrieveEntries: () => void;
  findEntryByIndex: (id: number) => TagTextEntryThroughModel | null;
}

const Entry: React.FC<IEntryProps> = React.memo(function Entry({
  id,
  index,
  moveEntry,
  findEntry,
  handleDelete,
  text_entry,
  tag,
  retrieveEntries,
  findEntryByIndex,
}) {
  useEffect(() => {
    console.info('useEffect');
    setTextEntry(text_entry);
  }, [text_entry]);

  const appConfig = useAppContext();
  const [showNew, setShowNew] = useState(false);
  const [textEntry, setTextEntry] = useState<ITextEntry | undefined>();
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const classes = useStyles();
  const [{isDragging}, drag, preview] = useDrag({
    item: () => ({id, originalIndex, type: ItemTypes.ENTRY}),
    type: ItemTypes.ENTRY,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      const drop_result: ITextEntry | null = monitor.getDropResult();
      const {id: droppedId, originalIndex} = monitor.getItem();
      const didDrop = monitor.didDrop();
      if (!didDrop) {
        moveEntry(droppedId, originalIndex);
      } else {
        if (drop_result?.type) {
          // Then it was dropped on something.
          if (drop_result.type === 'Tag') {
            const payload = {
              data: {
                type: 'TagTextEntryThroughModel',
                attributes: {},
                relationships: {
                  tag: {
                    data: {
                      type: 'Tag',
                      id: drop_result.id,
                    },
                  },
                  text_entry: {
                    data: {
                      type: 'TextEntry',
                      id: findEntry(id).entry.relationships.text_entry.data.id,
                    },
                  },
                },
              },
            };
            API.post('tags_entries', payload, {
              withCredentials: true,
            });
          }
        } else {
          // Then it was reordered in the list.
          if (originalIndex !== findEntry(id).index) {
            const entry = findEntry(id).entry;
            const entry_below = findEntryByIndex(index + 1);
            let ordered_top: TagTextEntryThroughModel | null;
            let ordered_bottom;
            if (entry_below === null) {
              //Then it was moved to the bottom position, get the entry before it.
              ordered_top = findEntryByIndex(index - 1);
              ordered_bottom = entry;
            } else {
              ordered_top = entry;
              ordered_bottom = entry_below;
            }
            if (ordered_top !== null && ordered_bottom !== null) {
              const payload = {
                data: {
                  type: 'TagTextEntryThroughModel',
                  attributes: {
                    top: ordered_top.id,
                    bottom: ordered_bottom.id,
                  },
                  relationships: {},
                },
              };
              API.post('/tags_entries/reorder', payload, {
                withCredentials: true,
              })
                .then(function () {})
                .catch(function (error) {
                  // handle error
                  console.log(error);
                })
                .then(function () {
                  // always executed
                });
            }
          } else {
            console.info("it wasn't moved.");
          }
        }
      }
    },
  });
  // Make sure opacity is above the useDrag call above
  const opacity = isDragging ? 0 : 1;
  const [, drop] = useDrop({
    accept: ItemTypes.ENTRY,
    hover(item: TagTextEntryThroughModel, monitor) {
      if (!dragRef.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = dragRef.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      if (clientOffset !== null) {
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        // Only perform the move when the mouse has crossed half of the items height
        // When dragging downwards, only move when the cursor is below 50%
        // When dragging upwards, only move when the cursor is above 50%
        // Dragging downwards
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }
        // Dragging upwards
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return;
        }
        moveEntry(item.id, hoverIndex);
        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        item.index = hoverIndex;
      }
    },
  });

  drag(dragRef);
  drop(dropRef);

  const mouseEnter = () => {
    if (
      appConfig.appStateStore.loggedInUser !== '' &&
      appConfig.entrySortOrder === 'order'
    ) {
      setShowDragHandle(true);
    }
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
  };

  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);
  const [isEditing, setIsEditing] = useState(false);

  const handleBeginEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = (updated_subject: string, updated_body: string) => {
    const payload = {
      data: {
        id: text_entry.id,
        type: 'TextEntry',
        attributes: {
          subject: updated_subject,
          body: updated_body,
        },
      },
    };
    API.patch('entries/' + text_entry.id, payload, {withCredentials: true})
      .then(function (response) {
        // handle success
        if (textEntry !== undefined) {
          const new_text_entry = {...textEntry};
          new_text_entry.attributes.subject =
            response.data.data.attributes.subject;
          new_text_entry.attributes.body = response.data.data.attributes.body;
          setTextEntry(new_text_entry);
          setIsEditing(false);
        }
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    (mouseData.mouseX = event.clientX - 2),
      (mouseData.mouseY = event.clientY - 4),
      setMouse(mouseData);
  };

  const handleNewEntry = () => {
    setShowNew(true);
  };

  const handleCancelNewEntry = () => {
    setShowNew(false);
  };

  const contextMenu = useMemo(
    () => (
      <EntryContextMenu
        mouse={mouse}
        id={id}
        text_entry={text_entry}
        handleDelete={handleDelete}
        handleNewEntry={handleNewEntry}
        handleBeginEdit={handleBeginEdit}
      />
    ),
    [mouse]
  );

  return (
    <>
      {!isEditing && (
        <div ref={dropRef} style={{opacity}} onContextMenu={handleContextClick}>
          <div ref={preview} className={classes.entryContainer}>
            <div
              className={classes.dragIndicatorContainer}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
            >
              <div
                ref={dragRef}
                className={classes.dragIndicator}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
                style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
              >
                ::
              </div>
            </div>
            <div
              className={classes.reuseCount}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
            >
              {/* {text_entry.attributes.reused_count} */}
            </div>
            <div
              className={classes.entry}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
            >
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

      {showNew && (
        <EntryNew
          tag={tag}
          retrieveEntries={retrieveEntries}
          handleCancelNewEntry={handleCancelNewEntry}
        />
      )}

      {appConfig.appStateStore.loggedInUser && <>{contextMenu}</>}

      {isEditing && (
        <EntryEdit
          subject={text_entry.attributes.subject}
          body={text_entry.attributes.body}
          handleSave={handleSave}
          handleCancelEdit={handleCancelEdit}
        />
      )}
    </>
  );
});
export default Entry;
