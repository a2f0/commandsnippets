import React from 'react';

import {useAppContext} from '../../../AppContext';
import {appMode} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewEntry = ({onClose}: IProps) => {
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

const memoizedNewEntry = React.memo(NewEntry);
export {memoizedNewEntry as NewEntry};
