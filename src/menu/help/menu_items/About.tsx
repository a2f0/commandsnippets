import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const About = function ({onClose}: IProps) {
  const handleClick = () => {
    onClose();
  };

  return (
    <StyledMenuItem id="HelpMenuAbout" onClick={handleClick}>
      About
    </StyledMenuItem>
  );
};

export default React.memo(About);
