import React, {useCallback} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {useSession} from '../../lib/data/hooks';
import {setTagPublic} from '../../lib/data/writes';
import type {IMouse} from '../../lib/shared';
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
  const {t} = useTypedTranslation('tags');
  const {t: tMenu} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  const session = useSession();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // The menu lives as long as the row: each handler calls the row's as it
  // is now (a delete goes through the session the row has now).
  const handleBeginEdit = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handleBeginEditParent();
      onClose();
    },
    [handleBeginEditParent, onClose]
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
    const {setTagNew} = useAppState.getState();
    onClose();
    setTagNew('top');
  }, [onClose]);

  const handleCancelDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleAcceptDialog = useCallback(() => {
    setDialogOpen(false);
    deleteTagParent();
  }, [deleteTagParent]);

  return (
    <>
      <ContextMenu id={`tagContextMenu-${id}`} mouse={mouse} onClose={onClose}>
        <StyledMenuItem
          id={`tag-context-menu-${id}-new-tag`}
          onClick={handleNewTag}
        >
          {tMenu('newTag')}
        </StyledMenuItem>
        <StyledMenuItem
          id={`tag-context-menu-${id}-edit-tag`}
          onClick={handleBeginEdit}
        >
          {t('editTag')}
        </StyledMenuItem>
        <StyledMenuItem
          id={`tagContextMenu${id}DeleteTagMenuItem`}
          onClick={handleDelete}
        >
          {t('deleteTag')}
        </StyledMenuItem>
        <StyledMenuItem
          id={`tag-context-menu-${id}-visibility`}
          onClick={() => {
            onClose();
            if (session !== null)
              void setTagPublic(session, id, !isPublic).catch(
                (error: unknown) =>
                  console.error('Failed to change tag visibility:', error)
              );
          }}
        >
          {isPublic ? tCommon('makePrivate') : tCommon('makePublic')}
        </StyledMenuItem>
      </ContextMenu>
      <TagDeleteDialog
        id={id}
        open={dialogOpen}
        handleAcceptDialog={handleAcceptDialog}
        handleCancelDialog={handleCancelDialog}
      />
    </>
  );
};

const memoizedTagContextMenu = React.memo(TagContextMenu);

export {memoizedTagContextMenu as TagContextMenu};
