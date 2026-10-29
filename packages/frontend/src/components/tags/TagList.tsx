import {List} from '@mui/material';
import {styled} from '@mui/material/styles';
import invariant from 'invariant';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useReadOnly} from '../../lib/data/hooks';
import {keyOfRow} from '../../lib/data/rowKey';
import {beginInteraction, listKey} from '../../lib/metrics/timings';
import {navigate} from '../../lib/router/navigation';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {ItemTypes} from '../dnd/itemTypes';
import {useDraggedRows} from '../dnd/useDraggedRows';
import {Tag} from './Tag';
import {TagListContextMenu} from './TagListContextMenu';
import {TagNew} from './TagNew';

export interface IUser {
  id: number;
  type: string;
  attributes: {
    username: string;
  };
}

export const LeftToRight: React.FC<React.HTMLAttributes<HTMLDivElement>> =
  styled('div')(() => ({
    direction: 'ltr',
  }));

const nameOf = (tag: ITagJsonApi) => tag.attributes.name;

interface IProps {
  tagsFromWrapper: ITagJsonApi[];
  username: string;
}
const TagList = ({tagsFromWrapper, username}: IProps) => {
  const appConfig = useAppConfig();
  // Another user's tags (staff reading them): no New Tag.
  const readOnly = useReadOnly();

  const [movedSelectedUp, setMovedSelectedUp] = useState<boolean>(false);

  const menu = useContextMenu();

  // The list as a drag reorders it.
  const {
    rows: tags,
    findEntry,
    findEntryByIndex,
    moveEntry,
  } = useDraggedRows(tagsFromWrapper, nameOf);

  // The tag highlighted: the one chosen in the list (the arrow keys, a
  // click) while the list and the tag selected (the tag shown) are those it
  // was chosen with; otherwise the tag selected, or the first.
  const {tagSelectedID} = appConfig;
  const [chosen, setChosen] = useState<{
    id: string;
    of: ITagJsonApi[];
    selected: string;
  } | null>(null);
  const selectedTag =
    chosen !== null &&
    chosen.of === tagsFromWrapper &&
    chosen.selected === tagSelectedID
      ? chosen.id
      : tags.some(tag => tag.id === tagSelectedID)
        ? tagSelectedID
        : tags[0]?.id;
  // The list and selection a choice is made with, which the rows' clicks
  // read: the function they are given stays the same.
  const choosingWith = useRef({of: tagsFromWrapper, selected: tagSelectedID});
  useLayoutEffect(() => {
    choosingWith.current = {of: tagsFromWrapper, selected: tagSelectedID};
  });
  const setSelectedTag = useCallback((id: string) => {
    setChosen({id, ...choosingWith.current});
  }, []);

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  // Add this function to properly connect the drop ref
  const dropBoxRef = (el: HTMLUListElement | null) => {
    drop(el);
  };

  const keyListener = useCallback(
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['ArrowUp', 'ArrowDown', 'Enter'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.tagsList
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = tags.find(c => c.id === selectedTag);
      if (selected !== undefined && appConfig.appMode === appMode.tagsList) {
        const selectedIndex = tags.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              const tag = tags[newIndex];
              invariant(tag, 'tag is undefined');
              setSelectedTag(tag.id);
              setMovedSelectedUp(true);
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            if (newIndex <= tags.length - 1) {
              const tag = tags[newIndex];
              invariant(tag, 'tag is undefined');
              setSelectedTag(tag.id);
              setMovedSelectedUp(false);
            }
          } else if (event.key === 'Enter') {
            beginInteraction(
              'tag switch',
              listKey({tag: selected.attributes.name})
            );
            appConfig.setAppMode(appMode.entriesList);
            appConfig.setActiveSearch(activeSearch.entries);
            navigate(`/${username}/${selected.attributes.name}`);
          }
        }
      }
    },
    [appConfig, username, tags, selectedTag]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

  return (
    <>
      {appConfig.tagNew === 'top' && !readOnly && <TagNew id="tagNewTop" />}
      <List
        ref={dropBoxRef}
        dense={true}
        id="tagList"
        sx={{
          paddingTop: theme => `${theme.main.paddingTop}`,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
          overflowY: 'auto',
          direction: 'rtl',
          height: theme =>
            `calc(100vh - ${theme.appBar.height}px - ${theme.footer.height}px)`,
        }}
        onContextMenu={readOnly ? undefined : menu.onContextMenu}
      >
        <LeftToRight>
          {tags.map((object: ITagJsonApi, i) => {
            return (
              <Tag
                object={object}
                // The same component when the API's id replaces a local one.
                key={keyOfRow(object)}
                id={object.id}
                moveEntry={moveEntry}
                findEntry={findEntry}
                index={i}
                findEntryByIndex={findEntryByIndex}
                isSelected={object.id === selectedTag}
                movedSelectedUp={
                  object.id === selectedTag ? movedSelectedUp : false
                }
                setSelectedTag={setSelectedTag}
              />
            );
          })}
        </LeftToRight>
        {appConfig.tagNew === 'bottom' && !readOnly && (
          <LeftToRight>
            <TagNew id="tagNewBottom" />
          </LeftToRight>
        )}
        {appConfig.loggedInUser && !readOnly && (
          <TagListContextMenu mouse={menu.mouse} onClose={menu.close} />
        )}
      </List>
    </>
  );
};

const memoizedTagList = React.memo(TagList);

export {memoizedTagList as TagList};
