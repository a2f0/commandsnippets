import React from 'react';

import {StyledMenu} from '../StyledMenu';
import {SyncIndexedDB} from './menuItems/SyncIndexedDB';
import {TriggerTestError} from './menuItems/TriggerTestError';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const DebugMenu = ({onClose, anchorEl}: IProps) => (
  <StyledMenu
    id="debug-menu"
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    <SyncIndexedDB onClose={onClose} />
    <TriggerTestError onClose={onClose} />
  </StyledMenu>
);

const memoizedDebugMenu = React.memo(DebugMenu);

export {memoizedDebugMenu as DebugMenu};
