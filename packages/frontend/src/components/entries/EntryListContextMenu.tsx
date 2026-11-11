import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import type {IMouse} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {StyledMenuItem} from '../../menu/StyledMenuItem';
import {ContextMenu} from '../ContextMenu';

interface IEntryListContextMenu {
  /**
   * Where the menu was opened (a right click below the entries), or nowhere
   * (null coordinates): closed.
   */
  mouse: IMouse;
  /** Close the menu: the list forgets where it was opened. */
  onClose: () => void;
}

const EntryListContextMenu = ({mouse, onClose}: IEntryListContextMenu) => {
  const {t} = useTypedTranslation('menu');
  const appConfig = useAppConfig();

  const handleNewEntry = (event: React.MouseEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.stopPropagation();
    appConfig.setEntryNew('textEntry-bottom');
    onClose();
  };

  return (
    <ContextMenu
      id="entryListContextMenu"
      keepMounted
      mouse={mouse}
      onClose={onClose}
    >
      <StyledMenuItem
        id="entryListContextMenuNewEntry"
        onClick={handleNewEntry}
      >
        {t('newEntry')}
      </StyledMenuItem>
    </ContextMenu>
  );
};

const memoizedEntryListContextMenu = React.memo(EntryListContextMenu);

export {memoizedEntryListContextMenu as EntryListContextMenu};
