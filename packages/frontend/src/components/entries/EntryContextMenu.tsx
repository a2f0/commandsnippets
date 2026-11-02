import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useOwner, useSession} from '../../lib/data/hooks';
import {setEntryPublic} from '../../lib/data/writes';
import {
  currentPath,
  navigate,
  useRoute,
  useSearchParam,
} from '../../lib/router/navigation';
import {entryPath} from '../../lib/router/route';
import type {IMouse} from '../../lib/shared';
import {useAppState} from '../../lib/state/appState';
import {StyledMenuItem} from '../../menu/StyledMenuItem';
import {ContextMenu} from '../ContextMenu';

interface IEntryContextMenu {
  /**
   * Where the menu was opened (the right click), or nowhere (null
   * coordinates): closed.
   */
  mouse: IMouse;
  /** Close the menu: the row forgets where it was opened. */
  onClose: () => void;
  id: string;
  text_entry: ITextEntryJsonApi;
  handleRemoveFromListParent: () => void;
  handleNewEntryParent: () => void;
  handleBeginEditParent: () => void;
  handleCopyParent: () => void;
  /**
   * Another user's entry: Copy is all it offers, and Get Info to staff (not
   * on public pages: the reuse count is private).
   */
  readOnly: boolean;
}

interface EntryMenuItem {
  id: string;
  label: string;
  action: () => void;
  /** Keeps the click from the row, which would select it. */
  stopsEvent?: boolean;
}

const isItem = (item: EntryMenuItem | false): item is EntryMenuItem =>
  item !== false;

/** The entry's page; its Back returns to this list. */
function openEntryPage(owner: string, id: string) {
  const page = entryPath(owner, id);
  useAppState.getState().setEntryReturnPath(page, currentPath());
  navigate(page);
}

/** What the menu offers on this entry, here, in order. */
function useEntryMenuItems({
  id,
  text_entry,
  handleRemoveFromListParent,
  handleNewEntryParent,
  handleBeginEditParent,
  handleCopyParent,
  readOnly,
}: IEntryContextMenu): EntryMenuItem[] {
  const {t} = useTypedTranslation('entries');
  const {t: tMenu} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  const session = useSession();
  const owner = useOwner();
  // Whether the list is a tag's, not which tag's: a tag switch renders no
  // row's menu again.
  const onTagList = useRoute(
    route => route.user !== undefined && route.tag !== undefined
  );
  const entriesFilter = useSearchParam('entries');
  const isPublic = text_entry.attributes.is_public;

  const toggleVisibility = () => {
    if (session !== null)
      void setEntryPublic(session, id, !isPublic).catch((error: unknown) =>
        console.error('Failed to change entry visibility:', error)
      );
  };

  return [
    {
      id: `tags-entries-context-menu-${id}-copy`,
      label: t('copyEntry'),
      action: handleCopyParent,
    },
    !(owner?.publicOnly ?? true) && {
      id: `tags-entries-context-menu-${id}-get-info`,
      label: t('getInfo'),
      action: () => owner !== null && openEntryPage(owner.owner, id),
    },
    !readOnly && {
      id: `tagsEntriesContextMenu${id}Edit`,
      label: t('editEntry'),
      action: handleBeginEditParent,
      stopsEvent: true,
    },
    !readOnly && {
      id: `entry-context-menu-${id}-visibility`,
      label: isPublic ? tCommon('makePrivate') : tCommon('makePublic'),
      action: toggleVisibility,
    },
    !readOnly && {
      id: `tags-entries-context-menu-${id}-new-entry`,
      label: tMenu('newEntry'),
      action: handleNewEntryParent,
      stopsEvent: true,
    },
    !readOnly &&
      onTagList && {
        id: `tagsEntriesContextMenu${id}Untag`,
        label: t('untagEntry'),
        action: handleRemoveFromListParent,
      },
    !readOnly &&
      entriesFilter === 'untagged' && {
        id: `tagsEntriesContextMenu${id}Delete`,
        label: tCommon('delete'),
        action: handleRemoveFromListParent,
      },
  ].filter(isItem);
}

const EntryContextMenu = (props: IEntryContextMenu) => {
  const {id, mouse, onClose} = props;
  const items = useEntryMenuItems(props);

  return (
    <ContextMenu
      id={`tagsEntriesContextMenu-${id}`}
      mouse={mouse}
      onClose={onClose}
    >
      {items.map(item => (
        <StyledMenuItem
          key={item.id}
          id={item.id}
          onClick={(event: React.MouseEvent<HTMLLIElement>) => {
            if (item.stopsEvent) {
              event.preventDefault();
              event.stopPropagation();
            }
            onClose();
            item.action();
          }}
        >
          {item.label}
        </StyledMenuItem>
      ))}
    </ContextMenu>
  );
};

const memoizedEntryContextMenu = React.memo(EntryContextMenu);

export {memoizedEntryContextMenu as EntryContextMenu};
