import AboutDialog from './AboutDialog';
import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const About = function ({onClose}: IProps) {
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
      <StyledMenuItem id="HelpMenuAbout" onClick={handleClick}>
        About
      </StyledMenuItem>
      <AboutDialog
        dialogOpen={dialogOpen}
        closeDialog={closeDialog}
      ></AboutDialog>
    </>
  );
};

export default React.memo(About);
