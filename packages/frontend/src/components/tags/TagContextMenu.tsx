import React, {useCallback} from 'react';
import {useSession} from '../../lib/data/hooks';
import {setTagPublic} from '../../lib/data/writes';
import {appMode, type IMouse} from '../../lib/shared';
import {useAppState} from '../../lib/state/appState';
import {StyledMenuItem} from '../../menu/StyledMenuItem';
import {ContextMenu} from '../ContextMenu';
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

  // The menu lives as long as the row: each handler calls the row's as it
  // is now (a delete goes through the session the row has now).
  const handleBeginEdit = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleBeginEditParent();
      handleClose();
    },
    [handleBeginEditParent, handleClose]
  );

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      setDialogOpen(true);
    },
    [onClose]
  );

  // A new tag's form, at the top of the list, as File > New Tag opens it.
  const handleNewTag = useCallback(() => {
    const {setAppMode, setTagNew} = useAppState.getState();
    setAppMode(appMode.tagEditor);
    handleClose();
    setTagNew('top');
  }, [handleClose]);

  const handleCancelDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleAcceptDialog = useCallback(() => {
    setDialogOpen(false);
    deleteTagParent();
  }, [deleteTagParent]);

  return (
    <>
      <ContextMenu
        id={`tagContextMenu-${id}`}
        mouse={mouse}
        onClose={handleClose}
      >
        <StyledMenuItem
          id={`tag-context-menu-${id}-new-tag`}
          onClick={handleNewTag}
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
      </ContextMenu>
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
