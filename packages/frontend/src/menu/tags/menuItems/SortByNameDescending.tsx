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

const SortByNameDescending = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-name-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-name');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-name' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByTagName')} <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByNameDescending = React.memo(SortByNameDescending);

export {memoizedSortByNameDescending as SortByNameDescending};
