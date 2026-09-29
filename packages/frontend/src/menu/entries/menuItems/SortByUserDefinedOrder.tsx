import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-order"
      key="SortMenuItemOrder"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('order');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'order' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortByUserDefinedOrder')}
    </StyledMenuItem>
  );
};

const memoizedSortByUserDefinedOrder = React.memo(SortByUserDefinedOrder);

export {memoizedSortByUserDefinedOrder as SortByUserDefinedOrder};
