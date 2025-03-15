import React from 'react';

import MenuBarButton from '../../MenuBarButton';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const HelpMenuButton = ({onClick}: IProps) => (
    <MenuBarButton
      id="helpMenuButton"
      ariaControls="help-menu"
      ariaLabel="Help"
      onClick={onClick}
    >
      Help
    </MenuBarButton>
  );
export default React.memo(HelpMenuButton);
