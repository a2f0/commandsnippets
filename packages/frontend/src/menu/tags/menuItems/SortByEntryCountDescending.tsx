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

const SortByEntryCountDescending = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-entry-count-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-entry_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-entry_count' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByEntryCount')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByEntryCountDescending = React.memo(
  SortByEntryCountDescending
);

export {memoizedSortByEntryCountDescending as SortByEntryCountDescending};
