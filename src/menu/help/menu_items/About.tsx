import React from 'react';

import {StyledMenuItem} from '../../../StyledMenuItem';
import {AboutDialog} from './AboutDialog';

interface IProps {
  onClose: () => void;
}

const About = ({onClose}: IProps) => {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const handleClick = () => {
    setDialogOpen(true);
    onClose();
  };

  const closeDialog = () => {
    setDialogOpen(false);
  };

  return (
    <>
      <StyledMenuItem id="about" onClick={handleClick}>
        About
      </StyledMenuItem>
      <AboutDialog dialogOpen={dialogOpen} closeDialog={closeDialog} />
    </>
  );
};

const memoizedAbout = React.memo(About);
export {memoizedAbout as About};
