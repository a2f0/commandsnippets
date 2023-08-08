import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = function ({onClose}: IProps) {
  return (
    <StyledMenuItem
      id="debug-menu-populate-indexed-db"
      key="Populate IndexedDB"
      onClick={() => {
        onClose();
      }}
    >
      Populate IndexedDB
    </StyledMenuItem>
  );
};

export default React.memo(SortByUserDefinedOrder);
