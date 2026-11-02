import {Divider} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {useOwner} from '../../lib/data/hooks';
import {navigate} from '../../lib/router/navigation';
import {analyticsPath, reusesPath} from '../../lib/router/route';
import {StyledMenu} from '../StyledMenu';
import {StyledMenuItem} from '../StyledMenuItem';
import {ShowTagCounts} from './menuItems/ShowTagCounts';
import {ThemeMenuItem} from './menuItems/ThemeMenuItem';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const ViewMenu = ({onClose, anchorEl}: IProps) => {
  const owner = useOwner();
  const {t} = useTypedTranslation('entries');
  const {t: tAnalytics} = useTypedTranslation('analytics');
  return (
    <StyledMenu
      id="view-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      {owner && !owner.readOnly && (
        <StyledMenuItem
          id="view-menu-analytics"
          onClick={() => {
            onClose();
            navigate(analyticsPath(owner.owner));
          }}
        >
          {tAnalytics('title')}
        </StyledMenuItem>
      )}
      {owner && !owner.readOnly && (
        <StyledMenuItem
          id="view-menu-reuses"
          onClick={() => {
            onClose();
            navigate(reusesPath(owner.owner));
          }}
        >
          {t('allReuses')}
        </StyledMenuItem>
      )}
      <ThemeMenuItem themeName="lightTheme" onClose={onClose} />
      <ThemeMenuItem themeName="darkTheme" onClose={onClose} />
      <Divider />
      <ShowTagCounts onClose={onClose} />
    </StyledMenu>
  );
};

const memoizedViewMenu = React.memo(ViewMenu);

export {memoizedViewMenu as ViewMenu};
