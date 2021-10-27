import * as Constants from './constants';
import {ITextEntryJsonApi, TextEntryHelpers} from './models/TextEntryModel';
import React, {useEffect, useMemo, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import Entry from './Entry';
import EntryListContextMenu from './EntryListContextMenu';
import EntryNew from './EntryNew';
import {IMouse} from './Entry';
import ItemTypes from './ItemTypes';
import {autorun} from 'mobx';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useDrop} from 'react-dnd';

export interface IParamTypes {
  user: string;
  tag: string;
}

interface IRelationships {
  [key: string]: IRelationship;
}

interface IRelationship {
  [key: string]: IRelationshipData;
}

interface IRelationshipData {
  type: string;
  id: string;
}

export interface TagTextEntryThroughModel {
  type: string;
  id: string;
  relationships: IRelationships;
  index: number;
}

const useStyles = makeStyles({
  root: {
    height: `calc(100vh - ${Constants.appBarHeight}px)`,
  },
});

const EntryList = () => {
  const classes = useStyles();
  const appConfig = useAppContext();
  const location = useLocation();
  const {user} = useParams<IParamTypes>();
  const {tag} = useParams<IParamTypes>();
  const [entries, setEntries] = useState<Array<ITextEntryJsonApi>>([]);

  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [
      location,
      appConfig.entrySortOrder,
      appConfig.untaggedEntrySortOrder,
      appConfig.mainPanel,
    ]
  );

  const retrieveEntries = () => {
    if (tag === 'untagged' && user !== undefined) {
      appConfig.fetchUntaggedTextEntries(user).then(() => {
        filterAndSort();
      });
    } else if (user !== undefined && tag !== undefined) {
      appConfig.fetchTextEntries(user, tag).then(() => {
        filterAndSort();
      });
    }
  };

  const filterAndSort = () => {
    if (appConfig.mainPanel === 'UntaggedEntryList' && user !== undefined) {
      setEntries(
        TextEntryHelpers.sort(
          user,
          null,
          appConfig.untaggedTextEntriesArray,
          appConfig.untaggedEntrySortOrder
        )
      );
    } else if (user !== undefined && tag !== undefined) {
      setEntries(
        TextEntryHelpers.sort(
          user,
          tag,
          appConfig.textEntriesArray,
          appConfig.entrySortOrder
        )
      );
    }
  };

  const moveEntry = (id: string, atIndex: number) => {
    const {entry, index} = findEntry(id);
    const reordered = update(entries, {
      $splice: [
        [index, 1],
        [atIndex, 0, entry],
      ],
    });
    setEntries(reordered);
  };

  const findEntry = (id: string) => {
    const entry = entries.filter(c => c.id === id)[0];
    return {
      entry,
      index: entries.indexOf(entry),
    };
  };
  const findEntryByIndex = (index: number) => {
    if (index > entries.length - 1) {
      return null;
    } else {
      return entries[index];
    }
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  const handleUntag = (id: string) => {
    setEntries(
      entries.filter(element => {
        return element.id !== id;
      })
    );
  };

  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    (mouseData.mouseX = event.clientX - 2),
      (mouseData.mouseY = event.clientY - 4),
      setMouse(mouseData);
  };

  const [mouse, setMouse] = useState(initialMouse);

  const contextMenu = useMemo(
    () => <EntryListContextMenu mouse={mouse} />,
    [mouse]
  );

  return (
    <div
      ref={drop}
      id="tagsEntriesList"
      className={classes.root}
      onContextMenu={handleContextClick}
    >
      {appConfig.entryNew === 'textEntry-top' && (
        <EntryNew filterAndSortParent={filterAndSort} />
      )}
      {entries.map((element, i) => {
        return (
          <Entry
            key={element.id}
            id={element.id}
            index={i}
            moveEntry={moveEntry}
            findEntry={findEntry}
            handleUntagParent={handleUntag}
            object={element}
            filterAndSortParent={filterAndSort}
            findEntryByIndex={findEntryByIndex}
          />
        );
      })}
      {appConfig.entryNew === 'textEntry-bottom' && (
        <EntryNew filterAndSortParent={filterAndSort} />
      )}
      {appConfig.loggedInUser && <>{contextMenu}</>}
    </div>
  );
};

export default React.memo(observer(EntryList));
