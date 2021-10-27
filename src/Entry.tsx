import * as Constants from './constants';
import {useDrag, useDrop} from 'react-dnd';
import {useMemo, useRef, useState} from 'react';
import API from './api';
import CheckIcon from '@material-ui/icons/Check';
import EntryContextMenu from './EntryContextMenu';
import EntryEdit from './EntryEdit';
import EntryNew from './EntryNew';
import FileCopySharpIcon from '@material-ui/icons/FileCopySharp';
import {IParamTypes} from './EntryList';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import ItemTypes from './ItemTypes';
import React from 'react';
import {TagTextEntryThroughModel} from './EntryList';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useParams} from 'react-router-dom';

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
  checkIndicator: {
    fontSize: '13px',
  },
  copyIndicator: {
    fontSize: '13px',
    cursor: 'pointer',
  },
  reuseCount: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
});

export interface IMouse {
  mouseX: number | null;
  mouseY: number | null;
}

interface IEntryProps {
  id: string;
  index: number;
  moveEntry: (id: string, to: number) => void;
  findEntry: (id: string) => {entry: ITextEntryJsonApi; index: number};
  handleUntagParent: (id: string) => void;
  object: ITextEntryJsonApi;
  filterAndSortParent: () => void;
  findEntryByIndex: (id: number) => ITextEntryJsonApi | null;
}

const Entry = ({
  id,
  index,
  moveEntry,
  findEntry,
  handleUntagParent,
  object,
  filterAndSortParent,
  findEntryByIndex,
}: IEntryProps) => {
  const appConfig = useAppContext();
  const [textEntryObject, setTextEntryObject] =
    useState<ITextEntryJsonApi>(object);
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const [showCopyIcon, setShowCopyIcon] = useState(false);
  const [showCheckIcon, setShowCheckIcon] = useState(false);
  const classes = useStyles();
  const {tag} = useParams<IParamTypes>();
  const {user} = useParams<IParamTypes>();
  const [{isDragging}, drag, preview] = useDrag({
    item: () => ({id, originalIndex, type: ItemTypes.ENTRY}),
    type: ItemTypes.ENTRY,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      const drop_result: ITextEntryJsonApi | null = monitor.getDropResult();
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
                      id: findEntry(id).entry.id,
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
            let ordered_top: ITextEntryJsonApi | null;
            let ordered_bottom: ITextEntryJsonApi | null;
            if (entry_below === null) {
              //Then it was moved to the bottom position, get the entry before it.
              ordered_top = findEntryByIndex(index - 1);
              ordered_bottom = entry;
            } else {
              ordered_top = entry;
              ordered_bottom = entry_below;
            }
            if (ordered_top !== null && ordered_bottom !== null) {
              // Then find the junction entries.
              const userObject = appConfig.usersArray.find(
                element =>
                  element.id === textEntryObject.relationships.user.data.id
              );

              const tagObject = appConfig.tagsArray.find(
                element =>
                  element.relationships.user.data.id === userObject?.id &&
                  element.relationships.user.data.id ===
                    textEntryObject.relationships.user.data.id &&
                  element.attributes.name === tag
              );

              const throughModelTop = appConfig.tagTextEntryThroughModel.find(
                element =>
                  element.relationships.tag.data.id === tagObject?.id &&
                  element.relationships.text_entry.data.id === ordered_top?.id
              );

              const throughModelBottom =
                appConfig.tagTextEntryThroughModel.find(
                  element =>
                    element.relationships.tag.data.id === tagObject?.id &&
                    element.relationships.text_entry.data.id ===
                      ordered_bottom?.id
                );

              const payload = {
                data: {
                  type: 'TagTextEntryThroughModel',
                  attributes: {
                    top: throughModelTop?.id,
                    bottom: throughModelBottom?.id,
                  },
                  relationships: {},
                },
              };
              API.post('/tags_entries/reorder', payload, {
                withCredentials: true,
              })
                .then(() => {})
                .catch(error => {
                  console.error(error);
                })
                .then(() => {});
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
      if (appConfig.entrySortOrder !== 'order') {
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
    if (appConfig.loggedInUser !== null) {
      setShowDragHandle(true);
    }
    setShowCopyIcon(true);
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
    setShowCopyIcon(false);
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

  const handleSave = (object: ITextEntryJsonApiResponseSingle) => {
    const existing = appConfig.textEntriesArray.find(
      o => o.id === object.data.id
    );
    existing?.update(object.data);
    setTextEntryObject(object.data);
    setIsEditing(false);
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
    appConfig.setEntryNew(`textEntry-${object.id}-top`);
  };

  const handleUntag = () => {
    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    const tagTextEntryThroughModelObject =
      appConfig.tagTextEntryThroughModel.find(
        element =>
          element.relationships.tag.data.id === tagObject?.id &&
          element.relationships.text_entry.data.id === textEntryObject.id
      );
    API.delete('/tags_entries/' + tagTextEntryThroughModelObject?.id, {
      withCredentials: true,
    });
    tagTextEntryThroughModelObject?.remove();
    handleUntagParent(textEntryObject.id);
  };

  const handleCopyClick = () => {
    setShowCopyIcon(false);
    setShowCheckIcon(true);
    navigator.clipboard.writeText(textEntryObject.attributes.body);
    appConfig.setMostRecentCopyType(textEntryObject.type);
    appConfig.setMostRecentCopyID(textEntryObject.id);
  };

  const contextMenu = useMemo(
    () => (
      <EntryContextMenu
        mouse={mouse}
        id={id}
        text_entry={textEntryObject}
        handleUntagParent={handleUntag}
        handleNewEntryParent={handleNewEntry}
        handleBeginEditParent={handleBeginEdit}
        handleCopyParent={handleCopyClick}
      />
    ),
    [mouse]
  );

  const handleBodyClick = () => {
    setShowCopyIcon(false);
    setShowCheckIcon(true);
    appConfig.setMostRecentCopyType(textEntryObject.type);
    appConfig.setMostRecentCopyID(textEntryObject.id);
  };

  const mostRecentCopy = () => {
    if (
      showCheckIcon === true &&
      appConfig.mostRecentCopyID === textEntryObject.id &&
      appConfig.mostRecentCopyType === textEntryObject.type
    ) {
      return true;
    } else {
      return false;
    }
  };

  return (
    <>
      {appConfig.entryNew === `textEntry-${object.id}-top` && (
        <EntryNew filterAndSortParent={filterAndSortParent} />
      )}
      {!isEditing && (
        <div
          ref={dropRef}
          style={{opacity}}
          onContextMenu={handleContextClick}
          id={`tagsEntries-${id}`}
        >
          <div ref={preview} className={classes.entryContainer}>
            <div>
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
                  {textEntryObject.attributes.subject}
                </div>
              </div>
            </div>
            <div>
              <div
                className={classes.dragIndicatorContainer}
                onClick={handleCopyClick}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
              >
                <div
                  className={classes.copyIndicator}
                  style={{
                    visibility: showCopyIcon ? 'visible' : 'hidden',
                    display: mostRecentCopy() ? 'none' : 'block',
                  }}
                >
                  <FileCopySharpIcon fontSize="inherit" />
                </div>
                <div
                  className={classes.checkIndicator}
                  style={{
                    visibility: mostRecentCopy() ? 'visible' : 'hidden',
                    display: mostRecentCopy() ? 'block' : 'none',
                  }}
                >
                  <CheckIcon fontSize="inherit" />
                </div>
              </div>
              <div className={classes.reuseCount}></div>
              <div
                className={classes.entry}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
              >
                <div onClick={handleBodyClick} className={classes.entryBody}>
                  {textEntryObject.attributes.body}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {appConfig.entryNew === `textEntry-${object.id}-bottom` && (
        <EntryNew filterAndSortParent={filterAndSortParent} />
      )}

      {appConfig.loggedInUser && <>{contextMenu}</>}

      {isEditing && (
        <EntryEdit
          object={textEntryObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

export default React.memo(observer(Entry));
