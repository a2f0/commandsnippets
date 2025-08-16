import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-subject-descending"
      key="SortMenuItemTextEntrySubject-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-subject' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Subject <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortBySubjectAscending = React.memo(SortByUserDefinedOrder);
export {memoizedSortBySubjectAscending as SortBySubjectAscending};
