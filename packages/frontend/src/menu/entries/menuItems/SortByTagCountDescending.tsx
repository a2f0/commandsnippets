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

const SortByTagCountDescending = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
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
