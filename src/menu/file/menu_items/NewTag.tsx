import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';
import {appMode} from '../../../lib/shared';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const NewTag = function ({onClose}: IProps) {
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
