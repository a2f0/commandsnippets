import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByDateTaggedAscending = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tagged-ascending"
      key="SortMenuItemTextEntryDateTagged"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('date_tagged');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'date_tagged' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortByDateTagged')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateTaggedAscending = React.memo(SortByDateTaggedAscending);

export {memoizedSortByDateTaggedAscending as SortByDateTaggedAscending};
