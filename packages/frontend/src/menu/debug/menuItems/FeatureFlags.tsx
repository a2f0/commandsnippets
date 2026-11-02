import React from 'react';

import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../StyledMenuItem';
import {FeatureFlagsDialog} from './FeatureFlagsDialog';

interface IProps {
  onClose: () => void;
}

/** Debug > Feature Flags: override the feature flags on this device. */
const FeatureFlags = ({onClose}: IProps) => {
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
      <StyledMenuItem id="debug-menu-feature-flags" onClick={handleClick}>
        {t('featureFlags')}
      </StyledMenuItem>
      <FeatureFlagsDialog dialogOpen={dialogOpen} closeDialog={closeDialog} />
    </>
  );
};

const memoizedFeatureFlags = React.memo(FeatureFlags);

export {memoizedFeatureFlags as FeatureFlags};
