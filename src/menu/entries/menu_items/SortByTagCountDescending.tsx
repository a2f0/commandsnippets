import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByTagCountDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tag-count-descending"
      key="SortMenuItemTextEntryTagCount-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-tag_count' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortByTagCount')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};
const memoizedSortByTagCountDescending = React.memo(SortByTagCountDescending);

export {memoizedSortByTagCountDescending as SortByTagCountDescending};
