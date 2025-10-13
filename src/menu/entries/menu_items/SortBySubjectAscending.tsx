import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortBySubjectAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-subject-descending"
      key="SortMenuItemTextEntrySubject-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-subject' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortBySubject')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortBySubjectAscending = React.memo(SortBySubjectAscending);
export {memoizedSortBySubjectAscending as SortBySubjectAscending};
