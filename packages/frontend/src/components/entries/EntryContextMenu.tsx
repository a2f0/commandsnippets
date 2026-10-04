import {Menu} from '@mui/material';
import React from 'react';
import type {ITextEntryJsonApi} from '../../lib/api/responses/types';
import {useSession} from '../../lib/data/hooks';
import {setEntryPublic} from '../../lib/data/writes';
import {useRoute, useSearchParam} from '../../lib/router/navigation';
import type {IMouse} from '../../lib/shared';
import {StyledMenuItem} from '../../menu/StyledMenuItem';

interface IStyledMenuProps {
  id: string;
  mousePosition: IMouse;
  open: boolean;
  onClose: () => void;
  anchorReference: 'anchorPosition';
  children: React.ReactNode;
}

/**
 * Not kept mounted: a closed menu renders nothing, so a list does not carry
 * a whole menu (in a portal of its own) for every row.
 */
const StyledMenu = ({
  id,
  mousePosition,
  open,
  onClose,
  anchorReference,
  children,
}: IStyledMenuProps) => {
  return (
    <Menu
      id={id}
      open={open}
      onClose={onClose}
      anchorReference={anchorReference}
      anchorPosition={
        mousePosition.mouseY !== null && mousePosition.mouseX !== null
          ? {top: mousePosition.mouseY, left: mousePosition.mouseX}
          : {top: 0, left: 0}
      }
    >
      {children}
    </Menu>
  );
};

export interface IEntryContextMenu {
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
  /** Another user's entry (staff reading it): Copy is all it offers. */
  readOnly: boolean;
}

const EntryContextMenu = ({
  mouse,
  onClose,
  id,
  handleRemoveFromListParent,
  handleNewEntryParent,
  handleBeginEditParent,
  handleCopyParent,
  readOnly,
  text_entry,
}: IEntryContextMenu) => {
  const session = useSession();
  // Whether the list is a tag's, not which tag's: a tag switch renders no
  // row's menu again.
  const onTagList = useRoute(
    route => route.user !== undefined && route.tag !== undefined
  );
  const entriesFilter = useSearchParam('entries');

  // Open where the row was right-clicked, from the row's state: no copy of
  // it here, which an effect would set again after every row mounts,
  // rendering every row's menu twice.
  const handleClose = onClose;

  const handleRemoveFromList = () => {
    handleRemoveFromListParent();
    handleClose();
  };

  const handleBeginEdit = () => {
    handleBeginEditParent();
    handleClose();
  };

  const handleNewEntry = () => {
    handleNewEntryParent();
    handleClose();
  };

  const handleCopy = () => {
    handleCopyParent();
    handleClose();
  };

  return (
    <StyledMenu
      id={`tagsEntriesContextMenu-${id}`}
      mousePosition={mouse}
      open={mouse.mouseY !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
    >
      <StyledMenuItem
        id={`tags-entries-context-menu-${id}-copy`}
        onClick={() => {
          handleCopy();
        }}
      >
        Copy
      </StyledMenuItem>
      {!readOnly && (
        <StyledMenuItem
          id={`tagsEntriesContextMenu${id}Edit`}
          onClick={(event: React.MouseEvent<HTMLLIElement>) => {
            event.preventDefault();
            event.stopPropagation();
            handleBeginEdit();
          }}
        >
          Edit
        </StyledMenuItem>
      )}
      {!readOnly && (
        <StyledMenuItem
          id={`entry-context-menu-${id}-visibility`}
          onClick={() => {
            handleClose();
            if (session !== null)
              void setEntryPublic(
                session,
                id,
                !text_entry.attributes.is_public
              ).catch((error: unknown) =>
                console.error('Failed to change entry visibility:', error)
              );
          }}
        >
          {text_entry.attributes.is_public ? 'Make private' : 'Make public'}
        </StyledMenuItem>
      )}
      {!readOnly && (
        <StyledMenuItem
          id={`tags-entries-context-menu-${id}-new-entry`}
          onClick={(event: React.MouseEvent<HTMLLIElement>) => {
            event.preventDefault();
            event.stopPropagation();
            handleNewEntry();
          }}
        >
          New Entry
        </StyledMenuItem>
      )}
      {!readOnly && onTagList && (
        <StyledMenuItem
          id={`tagsEntriesContextMenu${id}Untag`}
          onClick={() => {
            handleRemoveFromList();
          }}
        >
          Untag
        </StyledMenuItem>
      )}
      {!readOnly && entriesFilter === 'untagged' && (
        <StyledMenuItem
          id={`tagsEntriesContextMenu${id}Delete`}
          onClick={() => {
            handleRemoveFromList();
          }}
        >
          Delete
        </StyledMenuItem>
      )}
    </StyledMenu>
  );
};

const memoizedEntryContextMenu = React.memo(EntryContextMenu);

export {memoizedEntryContextMenu as EntryContextMenu};
