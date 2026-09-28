import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useEntrySortOrder} from '../../../hooks/useEntrySortOrder';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortBySubjectAscending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-subject-ascending"
      key="SortMenuItemTextEntrySubject"
      onClick={() => {
        setSortOrder('subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === 'subject' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortBySubject')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortBySubjectAscending = React.memo(SortBySubjectAscending);

export {memoizedSortBySubjectAscending as SortBySubjectAscending};
