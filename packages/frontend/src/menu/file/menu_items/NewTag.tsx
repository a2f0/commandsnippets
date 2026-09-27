import React from 'react';
import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {appMode} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewTag = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

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
