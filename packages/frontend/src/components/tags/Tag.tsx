import {Box, ListItem, ListItemButton} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {styled, useTheme} from '@mui/material/styles';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useReadOnly, useSession} from '../../lib/data/hooks';
import {deleteTag as deleteStoredTag, reorderTags} from '../../lib/data/writes';
import {beginInteraction, listKey} from '../../lib/metrics/timings';
import {
  currentRoute,
  navigate,
  useRouteParam,
} from '../../lib/router/navigation';
import {needsScrollingIntoView} from '../../lib/scroll';
import {activeSearch, appMode} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import {DragHandle} from '../dnd/DragHandle';
import {DragHandleContainer} from '../dnd/DragHandleContainer';
import {type DraggableItem, type DropResult, ItemTypes} from '../dnd/itemTypes';
import {type ISortableRow, useSortableRow} from '../dnd/useSortableRow';
import {TagContextMenu} from './TagContextMenu';
import {TagEdit} from './TagEdit';
import {TagLabel} from './TagLabel';

const TagContainer = styled('div')(() => ({
  whiteSpace: 'pre',
  lineHeight: '20px',
}));

const TagLabelWrapper = styled('div')(({theme}) => ({
  display: 'inline-block',
  cursor: 'pointer',
  width: `calc(100% - ${theme.main.dragIndicatorWidth}px)`,
  fontSize: '14px',
}));

interface DroppableItem {
  isOver: boolean;
  canDrop: boolean;
}

/**
 * Scrolls the selected tag into view when it becomes the selection, if it
 * is not: its top when the selection moved up, else its bottom.
 */
function useSelectedInView(
  isSelected: boolean,
  movedSelectedUp: boolean
): React.RefObject<HTMLLIElement | null> {
  const theme: Theme = useTheme();
  const tagRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (tagRef.current && isSelected && needsScrollingIntoView(tagRef, theme)) {
      tagRef.current.scrollIntoView({
        behavior: 'auto',
        block: movedSelectedUp ? 'start' : 'end',
      });
    }
  }, [isSelected]);
  return tagRef;
}

/**
 * A tag takes a tag dragged over it (a reorder), and an entry dropped on it
 * (a tagging); `isActiveHover` while one is over it.
 */
function useTagDrop(id: string, index: number, hover: ISortableRow['hover']) {
  const [{canDrop, isOver}, drop] = useDrop<
    DraggableItem,
    DropResult,
    DroppableItem
  >(
    () => ({
      accept: [ItemTypes.TAG, ItemTypes.ENTRY, ItemTypes.UNTAGGEDENTRY],
      canDrop: () => true,
      drop: (): DraggableItem => ({
        id,
        type: 'Tag',
        index,
        originalIndex: index,
      }),
      collect: monitor => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
      hover,
    }),
    [id, index, hover]
  );
  const dropRef = (el: HTMLDivElement | null) => {
    drop(el);
  };
  return {isActiveHover: canDrop && isOver, dropRef};
}

/** Shows the tag's entries, as a click on it does. */
function openTag(user: string | undefined, tag: ITagJsonApi) {
  beginInteraction('tag switch', listKey({tag: tag.attributes.name}));
  navigate(`/${user}/${tag.attributes.name}`);
  const state = useAppState.getState();
  // Reset the main panel in case Untagged Entries were being viewed.
  state.setAppMode(appMode.tagsList);
  state.incrementClickCount();
  state.setActiveSearch(activeSearch.entries);
  state.setEntrySearchString('');
  state.setTagSelectedID(tag.id);
}

/** The tag's editor: open or not; a save renames the tag shown too. */
function useTagEdit(tag: ITagJsonApi, user: string | undefined) {
  const [isEditing, setIsEditing] = useState(false);
  const begin = useCallback(() => setIsEditing(true), []);
  const cancel = () => setIsEditing(false);
  // The tag shown follows its new name.
  const save = (renamed: ITagJsonApi) => {
    setIsEditing(false);
    if (currentRoute().tag === tag.attributes.name) {
      navigate(`/${user}/${renamed.attributes.name}`, {replace: true});
    }
  };
  return {isEditing, begin, cancel, save};
}

/**
 * The drag handle shows while the pointer is over a tag the user can
 * reorder (signed in, their own, in their order).
 */
function useDragHandleShown(readOnly: boolean) {
  const [shown, setShown] = useState(false);
  const show = () => {
    const {loggedInUser, tagSortOrder} = useAppState.getState();
    if (loggedInUser !== null && !readOnly && tagSortOrder === 'order') {
      setShown(true);
    }
  };
  return {shown, show, hide: () => setShown(false)};
}

/** The writes a tag row makes, through the session the row has now. */
function useTagWrites(tagId: string) {
  const session = useSession();
  const reorder = useCallback(
    async (topId: string, bottomId: string) => {
      if (session !== null)
        await reorderTags(session, topId, bottomId).catch((error: unknown) =>
          console.error('Failed to reorder tags:', error)
        );
    },
    [session]
  );
  const deleteTag = useCallback(() => {
    if (session !== null)
      deleteStoredTag(session, tagId).catch((error: unknown) =>
        console.error('Failed to delete tag:', error)
      );
  }, [session, tagId]);
  return {reorder, deleteTag};
}

/** The tag's drag handle, name and (when shown) entry count. */
const TagContent = ({
  tag,
  previewRef,
  handleRef,
  dropRef,
  handleShown,
}: {
  tag: ITagJsonApi;
  previewRef: (el: HTMLDivElement | null) => void;
  handleRef: (el: HTMLDivElement | null) => void;
  dropRef: (el: HTMLDivElement | null) => void;
  handleShown: boolean;
}) => {
  const showTagCounts = useAppState(state => state.showTagCounts);
  return (
    <TagContainer ref={previewRef}>
      <DragHandleContainer role="tagDragHandleContainer">
        <DragHandle
          role="tagDragHandle"
          ref={handleRef}
          style={{visibility: handleShown ? 'visible' : 'hidden'}}
        >
          ::
        </DragHandle>
      </DragHandleContainer>
      <TagLabelWrapper
        id={`tagLabelWrapper-${tag.id}`}
        role="tagLabelWrapper"
        ref={dropRef}
      >
        <TagLabel label={tag.attributes.name} />
        {showTagCounts ? ` (${tag.attributes.entry_count})` : null}
      </TagLabelWrapper>
    </TagContainer>
  );
};

interface ITagProps {
  id: string;
  object: ITagJsonApi;
  moveEntry: (id: string, atIndex: number) => void;
  findEntry: (id: string) => {entry: ITagJsonApi; index: number};
  index: number;
  findEntryByIndex: (id: number) => ITagJsonApi | null;
  isSelected: boolean;
  movedSelectedUp: boolean;
  setSelectedTag: (id: string) => void;
}

const Tag = ({
  id,
  object,
  moveEntry,
  findEntry,
  index,
  findEntryByIndex,
  isSelected,
  movedSelectedUp,
  setSelectedTag,
}: ITagProps) => {
  const tagObject = object;
  const appConfig = useAppConfig();
  // Another user's tags (staff reading them): no reordering, editing or
  // context menu.
  const readOnly = useReadOnly();
  const theme: Theme = useTheme();
  // Whose page, not the tag shown: a tag switch renders only the two rows
  // whose selection changes.
  const user = useRouteParam('user');
  const tagRef = useSelectedInView(isSelected, movedSelectedUp);

  const {reorder, deleteTag} = useTagWrites(tagObject.id);
  const {isDragging, handleRef, preview, hover} = useSortableRow({
    type: ItemTypes.TAG,
    id,
    index,
    readOnly,
    findEntry,
    findEntryByIndex,
    moveEntry,
    reorder,
  });

  const {isActiveHover, dropRef} = useTagDrop(id, index, hover);

  const dragHandle = useDragHandleShown(readOnly);

  const menu = useContextMenu();
  const edit = useTagEdit(tagObject, user);

  const opacity = isDragging ? 0 : 1;

  const previewRef = (el: HTMLDivElement | null) => {
    preview(el);
  };

  const backgroundColor = isActiveHover
    ? theme.palette.action.hover
    : isSelected
      ? theme.selected.background
      : theme.palette.background.default;

  return (
    <>
      {!edit.isEditing && (
        <ListItem key={object.id} sx={{padding: 0}} ref={tagRef}>
          <ListItemButton
            data-testid={`tagListButton-${object.id}`}
            sx={{padding: 0}}
          >
            <Box
              ref={dropRef}
              style={{opacity}}
              onContextMenu={readOnly ? undefined : menu.onContextMenu}
              onClick={() => {
                openTag(user, object);
                setSelectedTag(object.id);
              }}
              id={`tag-${id}`}
              data-testid={`tag-${id}`}
              role="tag"
              aria-current={isSelected ? 'true' : undefined}
              onMouseEnter={dragHandle.show}
              onMouseLeave={dragHandle.hide}
              sx={{
                width: '100%',
                backgroundColor,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <TagContent
                tag={tagObject}
                previewRef={previewRef}
                handleRef={handleRef}
                dropRef={dropRef}
                handleShown={dragHandle.shown}
              />
            </Box>
          </ListItemButton>
        </ListItem>
      )}
      {appConfig.loggedInUser && !readOnly && (
        <TagContextMenu
          id={id}
          isPublic={object.attributes.is_public}
          mouse={menu.mouse}
          onClose={menu.close}
          deleteTagParent={deleteTag}
          handleBeginEditParent={edit.begin}
        />
      )}
      {edit.isEditing && !readOnly && (
        <TagEdit
          object={tagObject}
          handleSaveParent={edit.save}
          handleCancelEditParent={edit.cancel}
        />
      )}
    </>
  );
};

const memoizedTag = React.memo(Tag);

export {memoizedTag as Tag};
