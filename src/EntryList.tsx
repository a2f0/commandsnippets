import {ITextEntryJsonApi, TextEntryHelpers} from './models/TextEntryModel';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useParams} from 'react-router-dom';
import {CancelTokenSource} from 'axios';
import Entry from './Entry';
import EntryListContextMenu from './EntryListContextMenu';
import EntryNew from './EntryNew';
import {IEntryFetchPage} from './lib/text_entries';
import {IMouse} from './Entry';
import ItemTypes from './ItemTypes';
import {TagTextEntryThroughModel} from './models/TagTextEntryThroughModel';
import {autorun} from 'mobx';
import axios from 'axios';
import {entrySearchMethod} from './lib/shared';
import {keyCode} from './lib/shared';
import {observer} from 'mobx-react';
import update from 'immutability-helper';
import {useAppContext} from './AppContext';
import {useDrop} from 'react-dnd';
import {verticalPanel} from './lib/shared';

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

const EntryList = () => {
  const appConfig = useAppContext();
  const location = useLocation();
  const {user, tag} = useParams();

  // Used to access the react state from within the listener.
  const [entries, _setEntries] = useState<Array<ITextEntryJsonApi>>([]);
  const entriesRef = useRef(entries);
  const setEntries = (data: Array<ITextEntryJsonApi>) => {
    entriesRef.current = data;
    _setEntries(data);
  };

  const [previousTokenSource, setPreviousTokenSource] = useState<
    CancelTokenSource | undefined
  >(undefined);
  useEffect(
    () =>
      autorun(() => {
        retrieveEntries();
      }),
    [
      location,
      appConfig.entrySortOrder,
      appConfig.untaggedEntrySortOrder,
      appConfig.entrySearchMethod,
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

  useEffect(() => {
    filterAndSort();
  }, [appConfig.entrySearchString]);

  const filterAndSort = () => {
    if (appConfig.entrySearchMethod === entrySearchMethod.untaggedEntryList) {
      if (user !== undefined) {
        const array = TextEntryHelpers.sort(
          user,
          null,
          appConfig.untaggedTextEntriesArray,
          appConfig.untaggedEntrySortOrder
        );
        if (array.length > 1) {
          appConfig.setEntrySelectedID(array[0].id);
        }
        setEntries(array);
      }
    } else if (appConfig.entrySearchMethod === entrySearchMethod.allEntries) {
      if (user !== undefined) {
        const CancelToken = axios.CancelToken;
        const source = CancelToken.source();
        const fetchParams: IEntryFetchPage = {
          page: 1,
          username: user,
          sort: appConfig.entrySortOrder,
          search: appConfig.entrySearchString,
          source: source,
        };
        if (previousTokenSource !== undefined) {
          previousTokenSource.cancel();
        }
        setPreviousTokenSource(source);
        const p = TextEntryHelpers.fetchPage(fetchParams);
        p.then(a => {
          if (a) {
            // type guard
            const filtered: ITextEntryJsonApi[] = a.filter(
              (i): i is ITextEntryJsonApi => {
                return i.type === 'TextEntry';
              }
            );
            setEntries(filtered);
          }
        });
      }
    } else if (
      appConfig.entrySearchMethod === entrySearchMethod.currentTagOnly
    ) {
      if (user !== undefined && tag !== undefined) {
        const array = TextEntryHelpers.sort(
          user,
          tag,
          appConfig.textEntriesArray,
          appConfig.entrySortOrder
        );
        if (array.length > 1) {
          appConfig.setEntrySelectedID(array[0].id);
        }
        setEntries(array);
      }
    }
  };

  const keyListener = useCallback(
    event => {
      const trappedKeyCodes = [
        keyCode.Enter,
        keyCode.UpArrow,
        keyCode.DownArrow,
      ];
      if (
        trappedKeyCodes.includes(event.keyCode) &&
        appConfig.tagsOrEntries === verticalPanel.entries
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = entriesRef.current.find(
        c => c.id === appConfig.entrySelectedID
      );
      if (
        selected !== undefined &&
        appConfig.tagsOrEntries === verticalPanel.entries
      ) {
        const selectedIndex = entriesRef.current.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.keyCode === keyCode.UpArrow) {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              appConfig.setEntrySelectedID(entriesRef.current[newIndex].id);
            }
          } else if (event.keyCode === keyCode.DownArrow) {
            const newIndex = selectedIndex + 1;
            if (newIndex <= entriesRef.current.length - 1) {
              appConfig.setEntrySelectedID(entriesRef.current[newIndex].id);
            }
          } else if (event.keyCode === keyCode.Enter) {
            navigator.clipboard.writeText(selected.attributes.body);
            appConfig.setMostRecentCopyID(selected.id);
            appConfig.setMostRecentCopyType(selected.type);
          }
        }
      }
    },
    [entries]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, []);

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

  const handleRemoveFromList = (id: string) => {
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
    <div ref={drop} id="tagsEntriesList" onContextMenu={handleContextClick}>
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
            handleRemoveFromListParent={handleRemoveFromList}
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
