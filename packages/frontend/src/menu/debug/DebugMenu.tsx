import React from 'react';

import {StyledMenu} from '../StyledMenu';
import {PopulateIndexedDB} from './menuItems/PopulateIndexedDB';
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
    <PopulateIndexedDB onClose={onClose} />
    <TriggerTestError onClose={onClose} />
  </StyledMenu>
);

const memoizedDebugMenu = React.memo(DebugMenu);

export {memoizedDebugMenu as DebugMenu};
