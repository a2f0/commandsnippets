import * as Constants from './constants';
import {appMode, getSelection} from './lib/shared';
import {useDrag, useDrop} from 'react-dnd';
import {useEffect, useMemo, useRef, useState} from 'react';
import API from './api';
import CheckIcon from '@mui/icons-material/Check';
import EntryBody from './styled/text_entries/EntryBody';
import EntryContextMenu from './EntryContextMenu';
import EntryEdit from './EntryEdit';
import EntryNew from './EntryNew';
import EntrySubject from './styled/text_entries/EntrySubject';
import FileCopySharpIcon from '@mui/icons-material/FileCopySharp';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import ItemTypes from './ItemTypes';
import React from 'react';
import {TagTextEntryThroughModel} from './EntryList';
import {autorun} from 'mobx';
import makeStyles from '@mui/styles/makeStyles';
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
  handleRemoveFromListParent: (id: string) => void;
  object: ITextEntryJsonApi;
  filterAndSortParent: () => void;
  findEntryByIndex: (id: number) => ITextEntryJsonApi | null;
}

const Entry = ({
  id,
  index,
  moveEntry,
  findEntry,
  handleRemoveFromListParent,
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
  const {tag, user} = useParams();
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
            if (tag === 'untagged') {
              //Then an untagged entry was tagged
              handleRemoveFromListParent(object.id);
              appConfig.removeUntaggedTextEntry(object.id);
            }
          }
        } else {
          // Then it was reordered in the list.
          if (originalIndex !== findEntry(id).index) {
            console.info(
              'it moved from index ' +
                originalIndex +
                ' to ' +
                findEntry(id).index
            );
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
      if (appConfig.tagTextEntryThroughModelSortOrder !== 'order') {
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

  useEffect(
    () =>
      autorun(() => {
        if (appConfig.mostRecentCopyID === object.id) {
          setShowCheckIcon(true);
        } else {
          setShowCheckIcon(false);
        }
      }),
    [appConfig.mostRecentCopyID, appConfig.mostRecentCopyType]
  );

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
    appConfig.setAppMode(appMode.entryEditor);
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

  const handleRemoveFromList = () => {
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
    handleRemoveFromListParent(textEntryObject.id);
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
        handleRemoveFromListParent={handleRemoveFromList}
        handleNewEntryParent={handleNewEntry}
        handleBeginEditParent={handleBeginEdit}
        handleCopyParent={handleCopyClick}
      />
    ),
    [mouse]
  );

  const handleBodyClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const selection = getSelection();
    const selectionString = selection?.toString();
    appConfig.setAppMode(appMode.entriesList);
    if (selectionString === undefined || selectionString.length === 0) {
      setShowCopyIcon(false);
      setShowCheckIcon(true);
      navigator.clipboard.writeText(textEntryObject.attributes.body);
      appConfig.setMostRecentCopyType(textEntryObject.type);
      appConfig.setMostRecentCopyID(textEntryObject.id);
      appConfig.setAppMode(appMode.entriesList);
      appConfig.setEntrySelectedID(textEntryObject.id);
    } else {
      setShowCopyIcon(false);
      setShowCheckIcon(true);
      navigator.clipboard.writeText(selectionString);
      appConfig.setMostRecentCopyType(textEntryObject.type);
      appConfig.setMostRecentCopyID(textEntryObject.id);
      appConfig.setAppMode(appMode.entriesList);
    }
  };

  return (
    <>
      {appConfig.entryNew === `textEntry-${object.id}-top` && (
        <EntryNew
          id={`textEntryNew-${object.id}-top`}
          filterAndSortParent={filterAndSortParent}
        />
      )}
      {!isEditing && (
        <div
          role="entry"
          ref={dropRef}
          style={{opacity}}
          onContextMenu={handleContextClick}
          id={`tagsEntries-${id}`}
        >
          <div ref={preview} className={classes.entryContainer}>
            <div>
              <div
                role="entryDragHandleContainer"
                className={classes.dragIndicatorContainer}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
              >
                <div
                  role="entryDragHandle"
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
                <EntrySubject object={textEntryObject} />
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
                    display: showCopyIcon && !showCheckIcon ? 'block' : 'none',
                  }}
                >
                  <FileCopySharpIcon fontSize="inherit" />
                </div>
                <div
                  className={classes.checkIndicator}
                  style={{
                    visibility: showCheckIcon ? 'visible' : 'hidden',
                    display: showCheckIcon ? 'block' : 'none',
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
                <EntryBody
                  handleClick={handleBodyClick}
                  object={textEntryObject}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {appConfig.entryNew === `textEntry-${object.id}-bottom` && (
        <EntryNew
          id={`textEntryNew-${object.id}-bottom`}
          filterAndSortParent={filterAndSortParent}
        />
      )}

      {appConfig.loggedInUser && <>{contextMenu}</>}

      {isEditing && (
        <EntryEdit
          id={`textEntryEdit${object.id}`}
          object={textEntryObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

export default React.memo(observer(Entry));
