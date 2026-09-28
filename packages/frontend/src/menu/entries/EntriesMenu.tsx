import React from 'react';

import {useAppContext} from '../../AppContext';
import {entrySearchMethod} from '../../lib/shared';
import {StyledDivider} from '../../styled/StyledDivider';
import {StyledMenu} from '../StyledMenu';
import {AllEntries} from './menuItems/AllEntries';
import {SortByBodyAscending} from './menuItems/SortByBodyAscending';
import {SortByBodyDescending} from './menuItems/SortByBodyDescending';
import {SortByDateCreatedAscending} from './menuItems/SortByDateCreatedAscending';
import {SortByDateCreatedDescending} from './menuItems/SortByDateCreatedDescending';
import {SortByDateTaggedAscending} from './menuItems/SortByDateTaggedAscending';
import {SortByDateTaggedDescending} from './menuItems/SortByDateTaggedDescending';
import {SortBySubjectAscending} from './menuItems/SortBySubjectAscending';
import {SortBySubjectDescending} from './menuItems/SortBySubjectDescending';
import {SortByTagCountAscending} from './menuItems/SortByTagCountAscending';
import {SortByTagCountDescending} from './menuItems/SortByTagCountDescending';
import {SortByUserDefinedOrder} from './menuItems/SortByUserDefinedOrder';
import {UntaggedEntries} from './menuItems/UntaggedEntries';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const EntriesMenu = ({onClose, anchorEl}: IProps) => {
  const appConfig = useAppContext();
  return (
    <StyledMenu
      id="entries-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <AllEntries onClose={onClose} />
      <UntaggedEntries onClose={onClose} />
      <StyledDivider />
      {appConfig.entrySearchMethod === entrySearchMethod.currentTagOnly && [
        <SortByUserDefinedOrder onClose={onClose} key="SortMenuItemOrder" />,
        <SortByDateTaggedDescending onClose={onClose} key="SortDateTagged" />,
        <SortByDateTaggedAscending onClose={onClose} key="SortDateTagged-" />,
      ]}
      <SortBySubjectDescending onClose={onClose} />
      <SortBySubjectAscending onClose={onClose} />
      <SortByBodyDescending onClose={onClose} />
      <SortByBodyAscending onClose={onClose} />
      <SortByDateCreatedDescending onClose={onClose} />
      <SortByDateCreatedAscending onClose={onClose} />
      <SortByTagCountDescending onClose={onClose} />
      <SortByTagCountAscending onClose={onClose} />
    </StyledMenu>
  );
};

const memoizedEntriesMenu = React.memo(EntriesMenu);

export {memoizedEntriesMenu as EntriesMenu};
