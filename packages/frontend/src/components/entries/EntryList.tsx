import type {TextEntry} from '@commandsnippets/api-shared';
import {Box} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import invariant from 'invariant';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useDrop} from 'react-dnd';
import {useLocation, useParams, useSearchParams} from 'react-router-dom';
import {useAppContext} from '../../AppContext';
import {entrySortKey} from '../../lib/api/requests/entrySort';
import type {IEntryFetchPage} from '../../lib/api/requests/types';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {appMode, type IMouse, initialMouse} from '../../lib/shared';
import {TextEntryHelpers} from '../../lib/store/models/TextEntryModel';
import {needsScrollingIntoView} from '../../lib/textEntries';
import {ItemTypes} from '../dnd/itemTypes';
import {Entry} from './Entry';
import {EntryListContextMenu} from './EntryListContextMenu';
import {EntryNew} from './EntryNew';

export interface IParamTypes {
  user: string;
  tag: string;
}

function logFetchError(error: unknown) {
  console.error('Failed to fetch entries:', error);
}

const EntryList = () => {
  const appConfig = useAppContext();
  const location = useLocation();
  const {user, tag} = useParams();
  const theme: Theme = useTheme();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');

  const [entries, setEntries] = useState<Array<ITextEntryJsonApi>>([]);
  const [elRefs, setElRefs] = useState<
    Array<React.RefObject<HTMLDivElement | null>>
  >([]);

  useEffect(() => {
    setElRefs(
      Array.from({length: entries.length}, () =>
        React.createRef<HTMLDivElement | null>()
      )
    );
  }, [entries.length]);

  const [previousController, setPreviousController] = useState<
    AbortController | undefined
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
      appConfig
        .fetchUntaggedTextEntries(user)
        .then(() => {
          filterAndSort();
        })
        .catch(logFetchError);
    } else if (entriesFilter === 'all') {
      filterAndSort();
    } else if (user !== undefined && tag !== undefined) {
      appConfig
        .fetchTextEntries(user, tag)
        .then(() => {
          filterAndSort();
        })
        .catch(logFetchError);
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
        const controller = new AbortController();
        const fetchParams: IEntryFetchPage = {
          page: 1,
          username: user,
          sort: entrySortKey(appConfig.entrySortOrder),
          search: appConfig.entrySearchString,
          signal: controller.signal,
        };
        if (previousController !== undefined) {
          previousController.abort('New request initiated');
        }
        setPreviousController(controller);
        const p = TextEntryHelpers.fetchPage(fetchParams);
        p.then(a => {
          setEntries(
            a.filter((i): i is TextEntry => {
              return i.type === 'TextEntry';
            })
          );
        }).catch((error: unknown) => {
          // A newer request (the next search) aborted this one: not an error.
          if (!controller.signal.aborted) {
            logFetchError(error);
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
      const selected = entries.find(c => c.id === appConfig.entrySelectedID);
      if (selected !== undefined && appConfig.appMode === appMode.entriesList) {
        const selectedIndex = entries.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              const entry = entries[newIndex];
              if (entry) {
                appConfig.setEntrySelectedID(entry.id);
                const elRef = elRefs[newIndex];
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
            if (newIndex <= entries.length - 1) {
              const entry = entries[newIndex];
              invariant(entry, 'entry is undefined');
              appConfig.setEntrySelectedID(entry.id);
              const elRef = elRefs[newIndex];
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
    [appConfig, entries, elRefs, theme]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

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
      console.debug(
        `moveEntry: ${entry.attributes.subject} index ${index} moving to ${atIndex}`
      );
      const newEntries = [...entries];
      newEntries.splice(index, 1);
      newEntries.splice(atIndex, 0, entry);
      setEntries(newEntries);
    },
    [findEntry, entries]
  );

  const findEntryByIndex = (index: number): ITextEntryJsonApi | null => {
    if (index > entries.length - 1) {
      return null;
    }
    const entry = entries[index];
    invariant(entry, 'entry is undefined');
    return entry;
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
    mouseData.mouseX = event.clientX - 2;
    mouseData.mouseY = event.clientY - 4;
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
        const index = i;
        return (
          <div key={element.id} ref={elRefs[index]}>
            <Entry
              key={element.id}
              id={element.id}
              index={index}
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

const memoizedEntryList = React.memo(observer(EntryList));

export {memoizedEntryList as EntryList};
