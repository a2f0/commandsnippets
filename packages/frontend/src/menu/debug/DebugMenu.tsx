import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';
import {DialogMenuItem} from '../DialogMenuItem';
import {StyledMenu} from '../StyledMenu';
import {FeatureFlagsDialog} from './menuItems/FeatureFlagsDialog';
import {SyncIndexedDB} from './menuItems/SyncIndexedDB';
import {TriggerTestError} from './menuItems/TriggerTestError';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const DebugMenu = ({onClose, anchorEl}: IProps) => {
  const {t} = useTypedTranslation('menu');
  return (
    <StyledMenu
      id="debug-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      {/* Override the feature flags on this device. */}
      <DialogMenuItem
        id="debug-menu-feature-flags"
        label={t('featureFlags')}
        onClose={onClose}
        Dialog={FeatureFlagsDialog}
      />
      <SyncIndexedDB onClose={onClose} />
      <TriggerTestError onClose={onClose} />
    </StyledMenu>
  );
};

const memoizedDebugMenu = React.memo(DebugMenu);

export {memoizedDebugMenu as DebugMenu};
