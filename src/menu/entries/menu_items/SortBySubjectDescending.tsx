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

const SortBySubjectDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-subject-ascending"
      key="SortMenuItemTextEntrySubject"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'subject' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      {t('sortBySubject')} <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortBySubjectDescending = React.memo(SortBySubjectDescending);
export {memoizedSortBySubjectDescending as SortBySubjectDescending};
