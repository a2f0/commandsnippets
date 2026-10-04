import {Menu} from '@mui/material';
import React, {useCallback} from 'react';
import {useSession} from '../../lib/data/hooks';
import {setTagPublic} from '../../lib/data/writes';
import type {IMouse} from '../../lib/shared';
import {StyledMenuItem} from '../../menu/StyledMenuItem';
import {TagDeleteDialog} from './TagDeleteDialog';

interface ITagContextMenuProps {
  id: string;
  /** Whether the tag is public, for Make public or Make private. */
  isPublic: boolean;
  /**
   * Where the menu was opened (the right click), or nowhere (null
   * coordinates): closed.
   */
  mouse: IMouse;
  /** Close the menu: the tag forgets where it was opened. */
  onClose: () => void;
  deleteTagParent: () => void;
  handleBeginEditParent: () => void;
}

interface IStyledMenuProps {
  id: string;
  mousePosition: IMouse;
  open: boolean;
  onClose: () => void;
  anchorReference: 'anchorPosition';
  children: React.ReactNode;
}

/**
 * Not kept mounted: a closed menu renders nothing, so the tag list does not
 * carry a whole menu (in a portal of its own) for every tag.
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

const TagContextMenu = ({
  id,
  isPublic,
  mouse,
  onClose,
  deleteTagParent,
  handleBeginEditParent,
}: ITagContextMenuProps) => {
  const session = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  // Open where the tag was right-clicked, from the tag's state.
  const handleClose = onClose;

  const handleBeginEdit = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleBeginEditParent();
    handleClose();
  }, []);

  const handleDelete = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    setDialogOpen(true);
  }, []);

  const handleCancelDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleAcceptDialog = useCallback(() => {
    setDialogOpen(false);
    deleteTagParent();
  }, []);

  return (
    <>
      <StyledMenu
        id={`tagContextMenu-${id}`}
        mousePosition={mouse}
        open={mouse.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
      >
        <StyledMenuItem
          id={`tag-context-menu-${id}-new-tag`}
          onClick={handleClose}
        >
          New Tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`tag-context-menu-${id}-edit-tag`}
          onClick={handleBeginEdit}
        >
          Edit Tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`tagContextMenu${id}DeleteTagMenuItem`}
          onClick={handleDelete}
        >
          Delete Tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`tag-context-menu-${id}-visibility`}
          onClick={() => {
            handleClose();
            if (session !== null)
              void setTagPublic(session, id, !isPublic).catch(
                (error: unknown) =>
                  console.error('Failed to change tag visibility:', error)
              );
          }}
        >
          {isPublic ? 'Make private' : 'Make public'}
        </StyledMenuItem>
      </StyledMenu>
      <TagDeleteDialog
        id={id}
        open={dialogOpen}
        handleClose={handleClose}
        handleAcceptDialog={handleAcceptDialog}
        handleCancelDialog={handleCancelDialog}
      />
    </>
  );
};

const memoizedTagContextMenu = React.memo(TagContextMenu);

export {memoizedTagContextMenu as TagContextMenu};
