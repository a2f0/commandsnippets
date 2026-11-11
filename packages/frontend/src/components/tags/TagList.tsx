import {List} from '@mui/material';
import {styled} from '@mui/material/styles';
import React, {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import {useListKeyboard} from '../../hooks/useListKeyboard';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useReadOnly} from '../../lib/data/hooks';
import {keyOfRow} from '../../lib/data/rowKey';
import {beginInteraction, listKey} from '../../lib/metrics/timings';
import {navigate} from '../../lib/router/navigation';
import {tagPath} from '../../lib/router/route';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import {ItemTypes} from '../dnd/itemTypes';
import {useDraggedRows} from '../dnd/useDraggedRows';
import {Tag} from './Tag';
import {TagListContextMenu} from './TagListContextMenu';
import {TagNew} from './TagNew';

const LeftToRight: React.FC<React.HTMLAttributes<HTMLDivElement>> = styled(
  'div'
)(() => ({
  direction: 'ltr',
}));

const nameOf = (tag: ITagJsonApi) => tag.attributes.name;

/**
 * The tag highlighted: the one chosen in the list (the arrow keys, a click)
 * while the list and the tag selected (the tag shown) are those it was
 * chosen with; otherwise the tag selected, or the first. `choose` stays the
 * same across renders: what it needs of the list it reads through a ref.
 */
function useHighlightedTag(
  tagsFromWrapper: ITagJsonApi[],
  tags: readonly ITagJsonApi[]
) {
  const tagSelectedID = useAppState(state => state.tagSelectedID);
  const [chosen, setChosen] = useState<{
    id: string;
    of: ITagJsonApi[];
    selected: string;
  } | null>(null);
  const highlighted =
    chosen !== null &&
    chosen.of === tagsFromWrapper &&
    chosen.selected === tagSelectedID
      ? chosen.id
      : tags.some(tag => tag.id === tagSelectedID)
        ? tagSelectedID
        : tags[0]?.id;
  const choosingWith = useRef({of: tagsFromWrapper, selected: tagSelectedID});
  useLayoutEffect(() => {
    choosingWith.current = {of: tagsFromWrapper, selected: tagSelectedID};
  });
  const choose = useCallback((id: string) => {
    setChosen({id, ...choosingWith.current});
  }, []);
  return [highlighted, choose] as const;
}

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

  const [selectedTag, setSelectedTag] = useHighlightedTag(
    tagsFromWrapper,
    tags
  );

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  const dropBoxRef = (el: HTMLUListElement | null) => {
    drop(el);
  };

  useListKeyboard({
    mode: appMode.tagsList,
    rows: tags,
    selectedId: selectedTag,
    onSelect: (tag, _index, up) => {
      setSelectedTag(tag.id);
      setMovedSelectedUp(up);
    },
    onEnter: selected => {
      beginInteraction('tag switch', listKey({tag: selected.attributes.name}));
      appConfig.setAppMode(appMode.entriesList);
      appConfig.setActiveSearch(activeSearch.entries);
      navigate(tagPath(username, selected.attributes.name));
    },
  });

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
