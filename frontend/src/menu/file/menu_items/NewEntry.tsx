import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {appMode} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewEntry = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  const handleCreateEntry = () => {
    onClose();
    appConfig.setAppMode(appMode.entryEditor);
    appConfig.setEntryNew('textEntry-top');
  };

  return (
    <StyledMenuItem id="file-menu-new-entry" onClick={handleCreateEntry}>
      {t('newEntry')}
    </StyledMenuItem>
  );
};

const memoizedNewEntry = React.memo(NewEntry);
export {memoizedNewEntry as NewEntry};
