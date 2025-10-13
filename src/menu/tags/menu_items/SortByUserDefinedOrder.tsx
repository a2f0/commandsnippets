import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-order"
      onClick={() => {
        appConfig.setTagSortOrder('order');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'order' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByUserDefinedOrder')}
    </StyledMenuItem>
  );
};

const memoizedSortByUserDefinedOrder = React.memo(SortByUserDefinedOrder);
export {memoizedSortByUserDefinedOrder as SortByUserDefinedOrder};
