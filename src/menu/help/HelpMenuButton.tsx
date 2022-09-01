import MenuBarButton from '../../MenuBarButton';
import React from 'react';

interface IProps {
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const HelpMenuButton = function ({onClick}: IProps) {
  return (
    <MenuBarButton
      id="helpMenuButton"
      ariaControls="help-menu"
      ariaLabel="Help"
      onClick={onClick}
    >
      Help
    </MenuBarButton>
  );
};
export default React.memo(HelpMenuButton);
