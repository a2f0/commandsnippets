import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useEntrySortOrder} from '../../../hooks/useEntrySortOrder';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByTagCountDescending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-tag-count-descending"
      key="SortMenuItemTextEntryTagCount-"
      onClick={() => {
        setSortOrder('-tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === '-tag_count' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByTagCount')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};
const memoizedSortByTagCountDescending = React.memo(SortByTagCountDescending);

export {memoizedSortByTagCountDescending as SortByTagCountDescending};
