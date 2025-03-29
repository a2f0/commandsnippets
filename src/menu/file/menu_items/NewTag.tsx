import React from 'react';

import {useAppContext} from '../../../AppContext';
import {appMode} from '../../../lib/shared';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const NewTag = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleCreateTag = () => {
    appConfig.setAppMode(appMode.tagEditor);
    onClose();
    appConfig.setTagNew('top');
  };

  return (
    <StyledMenuItem id="file-menu-new-tag" onClick={handleCreateTag}>
      New Tag
    </StyledMenuItem>
  );
};

export default React.memo(NewTag);
