import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByTagCountAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tag-count-ascending"
      key="SortMenuItemTextEntryTagCount"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'tag_count' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortByTagCount')}
      <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByTagCountAscending = React.memo(SortByTagCountAscending);

export {memoizedSortByTagCountAscending as SortByTagCountAscending};
