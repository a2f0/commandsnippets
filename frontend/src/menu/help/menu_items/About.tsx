import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {AboutDialog} from './AboutDialog';

interface IProps {
  onClose: () => void;
}

const About = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
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
        {t('about')}
      </StyledMenuItem>
      <AboutDialog dialogOpen={dialogOpen} closeDialog={closeDialog} />
    </>
  );
};

const memoizedAbout = React.memo(About);

export {memoizedAbout as About};
