import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {useOwner} from '../../lib/data/hooks';
import {navigate} from '../../lib/router/navigation';
import {analyticsPath, reusesPath} from '../../lib/router/route';
import {StyledDivider} from '../../styled/StyledDivider';
import {StyledMenu} from '../StyledMenu';
import {StyledMenuItem} from '../StyledMenuItem';
import {DarkMode} from './menuItems/DarkMode';
import {LightMode} from './menuItems/LightMode';
import {ShowTagCounts} from './menuItems/ShowTagCounts';

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
      <LightMode onClose={onClose} />
      <DarkMode onClose={onClose} />
      <StyledDivider />
      <ShowTagCounts onClose={onClose} />
    </StyledMenu>
  );
};

const memoizedViewMenu = React.memo(ViewMenu);

export {memoizedViewMenu as ViewMenu};
