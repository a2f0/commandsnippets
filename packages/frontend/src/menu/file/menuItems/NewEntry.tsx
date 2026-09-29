import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {appMode} from '../../../lib/shared';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewEntry = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
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
