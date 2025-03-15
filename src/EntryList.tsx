import {Box} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import type {CancelTokenSource} from 'axios';
import axios from 'axios';
import invariant from 'invariant';
import update from 'immutability-helper';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import React, {
  createRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useDrop} from 'react-dnd';
import {useLocation, useParams, useSearchParams} from 'react-router-dom';

import {useAppContext} from './AppContext';
import Entry from './Entry';
import EntryListContextMenu from './EntryListContextMenu';
import EntryNew from './EntryNew';
import ItemTypes from './ItemTypes';
import {appMode, type IMouse, initialMouse} from './lib/shared';
import type {IEntryFetchPage} from './lib/text_entries';
import {needsScrollingIntoView} from './lib/text_entries';
import {type ITextEntryJsonApi, TextEntryHelpers} from './models/TextEntryModel';

export interface IParamTypes {
  user: string;
  tag: string;
}

const EntryList = () => {
  const appConfig = useAppContext();
  const location = useLocation();
  const {user, tag} = useParams();
  const theme: Theme = useTheme();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');

  // Used to access the react state from within the listener.
  const [entries, _setEntries] = useState<Array<ITextEntryJsonApi>>([]);
  const entriesRef = useRef<Array<ITextEntryJsonApi>>(entries);
  const setEntries = (data: Array<ITextEntryJsonApi>) => {
    entriesRef.current = data;
    _setEntries(data);
  };

  const [elRefs, _setElRefs] = useState<
    Array<React.RefObject<HTMLDivElement | null>>
  >([]);
  // Used to access the react state from within the listener.
  const elRefsRef = useRef(elRefs);
  const setElRefs = (data: Array<React.RefObject<HTMLDivElement | null>>) => {
    elRefsRef.current = data;
    _setElRefs(data);
  };
  useEffect(() => {
    const refsArray = Array<React.RefObject<HTMLDivElement | null>>(
      entries.length
    );
    for (let index = 0; index < refsArray.length; index++) {
      refsArray[index] = createRef<HTMLDivElement>();
    }
    setElRefs(refsArray);
  }, [entries.length]);

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
      searchParams,
      appConfig.tagTextEntryThroughModelSortOrder,
      appConfig.entrySortOrder,
      appConfig.entrySearchMethod,
    ]
  );

  const retrieveEntries = () => {
    if (entriesFilter === 'untagged' && user !== undefined) {
      appConfig.fetchUntaggedTextEntries(user).then(() => {
        filterAndSort();
      });
    } else if (entriesFilter === 'all') {
      filterAndSort();
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
    let array: ITextEntryJsonApi[] = [];
    if (entriesFilter === 'untagged') {
      if (user !== undefined) {
        array = TextEntryHelpers.sort(
          user,
          null,
          appConfig.untaggedTextEntriesArray,
          appConfig.entrySortOrder,
          appConfig
        );
        if (array[0]) {
          appConfig.setEntrySelectedID(array[0].id);
        }
        setEntries(array);
      }
    } else if (entriesFilter === 'all') {
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
    } else {
      if (user !== undefined && tag !== undefined) {
        const array = TextEntryHelpers.sort(
          user,
          tag,
          appConfig.textEntriesArray,
          appConfig.tagTextEntryThroughModelSortOrder,
          appConfig
        );
        setEntries(array);
        const current = array.find(
          element => element.id === appConfig.entrySelectedID
        );
        if (current === undefined) {
          if (array[0]) {
            appConfig.setEntrySelectedID(array[0].id);
          }
        }
      }
    }
  };

  const keyListener = useCallback(
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['Enter', 'ArrowUp', 'ArrowDown'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.entriesList
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = entriesRef.current.find(
        c => c.id === appConfig.entrySelectedID
      );
      if (selected !== undefined && appConfig.appMode === appMode.entriesList) {
        const selectedIndex = entriesRef.current.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              const entry = entriesRef.current[newIndex];
              if (entry) {
                appConfig.setEntrySelectedID(entry.id);
                const elRef = elRefsRef.current[newIndex];
                invariant(elRef, 'entry ref is undefined');
                if (needsScrollingIntoView(elRef, theme)) {
                  elRef.current?.scrollIntoView({
                    behavior: 'auto',
                    block: 'start',
                  });
                }
              }
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            if (newIndex <= entriesRef.current.length - 1) {
              const entry = entriesRef.current[newIndex];
              invariant(entry, 'entry is undefined');
              appConfig.setEntrySelectedID(entry.id);
              const elRef = elRefsRef.current[newIndex];
              invariant(elRef, 'entry ref is undefined');
              if (needsScrollingIntoView(elRef, theme)) {
                elRef.current?.scrollIntoView({
                  behavior: 'auto',
                  block: 'end',
                });
              }
            }
          } else if (event.key === 'Enter') {
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

  const findEntry = useCallback(
    (id: string) => {
      const entry = entries.filter(c => c.id === id)[0];
      invariant(entry, 'entry is undefined');
      return {
        entry,
        index: entries.indexOf(entry),
      };
    },
    [entries]
  );

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const {entry, index} = findEntry(id);
      console.info(
        `entry: ${entry.attributes.subject} index ${index} moving to ${atIndex}`
      );
      const reordered = update(entries, {
        $splice: [
          [index, 1],
          [atIndex, 0, entry],
        ],
      });
      setEntries(reordered);
    },
    [findEntry, entries, setEntries]
  );

  const findEntryByIndex = (index: number): ITextEntryJsonApi | null => {
    if (index > entries.length - 1) {
      return null;
    } else {
      const entry = entries[index];
      invariant(entry, 'entry is undefined');
      return entry;
    }
  };

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  // Add this function to properly connect the drop ref
  const dropBoxRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  const handleRemoveFromList = (id: string) => {
    setEntries(
      entries.filter(element => {
        return element.id !== id;
      })
    );
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    (mouseData.mouseX = event.clientX - 2),
      (mouseData.mouseY = event.clientY - 4),
      setMouse(mouseData);
  };

  const onMouseDown = () => {
    appConfig.setEntrySelectedID('');
  };

  const [mouse, setMouse] = useState(initialMouse);

  const contextMenu = useMemo(
    () => <EntryListContextMenu mouse={mouse} />,
    [mouse]
  );

  return (
    <Box
      ref={dropBoxRef}
      id="tagsEntriesList"
      onMouseDown={onMouseDown}
      sx={{
        flexGrow: '1',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {appConfig.entryNew === 'textEntry-top' && (
        <EntryNew id="textEntryNewTop" filterAndSortParent={filterAndSort} />
      )}
      {entries.map((element, i) => {
        return (
          <div key={element.id} ref={elRefs[i]}>
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
          </div>
        );
      })}
      {appConfig.entryNew === 'textEntry-bottom' && (
        <EntryNew id="textEntryNewBottom" filterAndSortParent={filterAndSort} />
      )}
      <Box
        onContextMenu={handleContextClick}
        sx={{
          flexGrow: '1',
        }}
      />
      {appConfig.loggedInUser && <>{contextMenu}</>}
    </Box>
  );
};

export default React.memo(observer(EntryList));
