import React from 'react';
import {useTranslation} from 'react-i18next';

import {useAppContext} from '../../../AppContext';
import {appMode} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewTag = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTranslation('menu');

  const handleCreateTag = () => {
    appConfig.setAppMode(appMode.tagEditor);
    onClose();
    appConfig.setTagNew('top');
  };

  return (
    <StyledMenuItem id="file-menu-new-tag" onClick={handleCreateTag}>
      {t('newTag')}
    </StyledMenuItem>
  );
};

const memoizedNewTag = React.memo(NewTag);
export {memoizedNewTag as NewTag};
