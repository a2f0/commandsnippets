import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';
import {appMode} from '../../../lib/shared';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const NewEntry = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  const handleCreateEntry = () => {
    onClose();
    appConfig.setAppMode(appMode.entryEditor);
    appConfig.setEntryNew('textEntry-top');
  };

  return (
    <StyledMenuItem id="file-menu-new-entry" onClick={handleCreateEntry}>
      New Entry
    </StyledMenuItem>
  );
};

export default React.memo(NewEntry);
