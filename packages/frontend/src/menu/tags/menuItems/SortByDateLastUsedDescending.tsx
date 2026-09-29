import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByDateLastUsedDescending = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-date-last-used-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-date_last_used');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-date_last_used' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateLastUsed')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateLastUsedDescending = React.memo(
  SortByDateLastUsedDescending
);

export {memoizedSortByDateLastUsedDescending as SortByDateLastUsedDescending};
