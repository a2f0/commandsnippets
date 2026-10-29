import React from 'react';
import {appMode, type IMouse} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {StyledMenuItem} from '../../menu/StyledMenuItem';
import {ContextMenu} from '../ContextMenu';

interface ITagListContextMenuProps {
  /**
   * Where the menu was opened (a right click below the tags), or nowhere
   * (null coordinates): closed.
   */
  mouse: IMouse;
  /** Close the menu: the list forgets where it was opened. */
  onClose: () => void;
}

const TagListContextMenu = ({mouse, onClose}: ITagListContextMenuProps) => {
  const appConfig = useAppConfig();

  const handleNewTag = () => {
    appConfig.setTagNew('bottom');
    appConfig.setAppMode(appMode.tagEditor);
    onClose();
  };

  return (
    <ContextMenu
      id="tagListContextMenu"
      keepMounted
      mouse={mouse}
      onClose={onClose}
    >
      <StyledMenuItem id="tagListContextMenuNew" onClick={handleNewTag}>
        New Tag
      </StyledMenuItem>
    </ContextMenu>
  );
};

const memoizedTagListContextMenu = React.memo(TagListContextMenu);

export {memoizedTagListContextMenu as TagListContextMenu};
