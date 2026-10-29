import type {StyledComponent} from '@emotion/styled';
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
import {useAppConfig} from '../../lib/state/appState';
import {DragHandle} from '../dnd/DragHandle';
import {DragHandleContainer} from '../dnd/DragHandleContainer';
import {type DraggableItem, type DropResult, ItemTypes} from '../dnd/itemTypes';
import {useSortableRow} from '../dnd/useSortableRow';
import {TagContextMenu} from './TagContextMenu';
import {TagEdit} from './TagEdit';
import {TagLabel} from './TagLabel';

const TagContainer = styled('div')(() => ({
  whiteSpace: 'pre',
  lineHeight: '20px',
}));

// Update TagLabelWrapper definition
const TagLabelWrapper = styled('div', {
  shouldForwardProp: prop => prop !== 'ref',
})`
  display: inline-block;
  cursor: pointer;
  width: calc(100% - ${props => props.theme.main.dragIndicatorWidth}px);
  font-size: 14px;
` as StyledComponent<{
  ref?: React.RefCallback<HTMLDivElement>;
  id?: string;
  role?: string;
  children?: React.ReactNode;
}>;

interface DroppableItem {
  isOver: boolean;
  canDrop: boolean;
}

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
  const session = useSession();
  // Another user's tags (staff reading them): no reordering, editing or
  // context menu.
  const readOnly = useReadOnly();
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme: Theme = useTheme();
  // Whose page, not the tag shown: a tag switch renders only the two rows
  // whose selection changes.
  const user = useRouteParam('user');
  const tagRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (
      tagRef.current &&
      isSelected === true &&
      needsScrollingIntoView(tagRef, theme)
    ) {
      if (movedSelectedUp === true) {
        tagRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      } else {
        tagRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    }
  }, [isSelected]);

  const reorder = useCallback(
    async (topId: string, bottomId: string) => {
      if (session === null) {
        return;
      }
      await reorderTags(session, topId, bottomId).catch((error: unknown) => {
        console.error('Failed to reorder tags:', error);
      });
    },
    [session]
  );

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

  // A tag takes a tag dragged over it (a reorder), and an entry dropped on
  // it (a tagging).
  const [{canDrop, isOver}, drop] = useDrop<
    DraggableItem,
    DropResult,
    DroppableItem
  >(
    () => ({
      accept: [ItemTypes.TAG, ItemTypes.ENTRY, ItemTypes.UNTAGGEDENTRY],
      canDrop: () => {
        return true;
      },
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

  const mouseEnter = () => {
    if (
      appConfig.loggedInUser !== null &&
      !readOnly &&
      appConfig.tagSortOrder === 'order'
    ) {
      setShowDragHandle(true);
    }
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
  };

  const menu = useContextMenu();
  const [isEditing, setIsEditing] = useState(false);

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // The tag shown follows its new name.
  const handleSave = (renamed: ITagJsonApi) => {
    setIsEditing(false);
    if (currentRoute().tag === tagObject.attributes.name) {
      navigate(`/${user}/${renamed.attributes.name}`, {replace: true});
    }
  };

  const deleteTag = useCallback(() => {
    if (session === null) {
      return;
    }
    deleteStoredTag(session, tagObject.id).catch((error: unknown) => {
      console.error('Failed to delete tag:', error);
    });
  }, [session, tagObject.id]);

  const handleBeginEdit = useCallback(() => {
    setIsEditing(true);
  }, []);

  const opacity = isDragging ? 0 : 1;

  const dropBoxRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  const previewRef = (el: HTMLDivElement | null) => {
    preview(el);
  };

  const handleTagClick = (object: ITagJsonApi): void => {
    beginInteraction('tag switch', listKey({tag: object.attributes.name}));
    navigate(`/${user}/${object.attributes.name}`);
    // Reset the main panel in case Untagged Entries were being viewed.
    appConfig.setAppMode(appMode.tagsList);
    appConfig.incrementClickCount();
    appConfig.setActiveSearch(activeSearch.entries);
    appConfig.setEntrySearchString('');
    appConfig.setTagSelectedID(object.id);
    setSelectedTag(object.id);
  };

  const isActiveHover = canDrop && isOver;
  let backgroundColor = theme.palette.background.default;
  if (isActiveHover) {
    backgroundColor = theme.palette.action.hover;
  } else if (isSelected) {
    backgroundColor = theme.selected.background;
  }

  const dropLabelRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  return (
    <>
      {!isEditing && (
        <ListItem
          key={object.id}
          sx={{
            padding: 0,
          }}
          ref={tagRef}
        >
          <ListItemButton
            data-testid={`tagListButton-${object.id}`}
            sx={{
              padding: 0,
            }}
          >
            <Box
              ref={dropBoxRef}
              style={{opacity}}
              onContextMenu={readOnly ? undefined : menu.onContextMenu}
              onClick={() => {
                handleTagClick(object);
              }}
              id={`tag-${id}`}
              data-testid={`tag-${id}`}
              role="tag"
              aria-current={isSelected ? 'true' : undefined}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
              sx={{
                width: '100%',
                backgroundColor,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <TagContainer ref={previewRef}>
                <DragHandleContainer role="tagDragHandleContainer">
                  <DragHandle
                    role="tagDragHandle"
                    ref={handleRef}
                    style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
                  >
                    ::
                  </DragHandle>
                </DragHandleContainer>
                <TagLabelWrapper
                  id={`tagLabelWrapper-${id}`}
                  role="tagLabelWrapper"
                  ref={dropLabelRef}
                >
                  <TagLabel label={tagObject.attributes.name} />
                  {appConfig.showTagCounts
                    ? ` (${tagObject.attributes.entry_count})`
                    : null}
                </TagLabelWrapper>
              </TagContainer>
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
          handleBeginEditParent={handleBeginEdit}
        />
      )}
      {isEditing && !readOnly && (
        <TagEdit
          object={tagObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

const memoizedTag = React.memo(Tag);

export {memoizedTag as Tag};
