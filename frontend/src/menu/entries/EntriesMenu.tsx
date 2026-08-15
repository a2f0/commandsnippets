import React from 'react';

import {useAppContext} from '../../AppContext';
import {entrySearchMethod} from '../../lib/shared';
import {StyledMenu} from '../../MenuBar';
import {StyledDivider} from '../../styled/StyledDivider';
import {AllEntries} from './menu_items/AllEntries';
import {SortByBodyAscending} from './menu_items/SortByBodyAscending';
import {SortByBodyDescending} from './menu_items/SortByBodyDescending';
import {SortByDateCreatedAscending} from './menu_items/SortByDateCreatedAscending';
import {SortByDateCreatedDescending} from './menu_items/SortByDateCreatedDescending';
import {SortByDateTaggedAscending} from './menu_items/SortByDateTaggedAscending';
import {SortByDateTaggedDescending} from './menu_items/SortByDateTaggedDescending';
import {SortBySubjectAscending} from './menu_items/SortBySubjectAscending';
import {SortBySubjectDescending} from './menu_items/SortBySubjectDescending';
import {SortByTagCountAscending} from './menu_items/SortByTagCountAscending';
import {SortByTagCountDescending} from './menu_items/SortByTagCountDescending';
import {SortByUserDefinedOrder} from './menu_items/SortByUserDefinedOrder';
import {UntaggedEntries} from './menu_items/UntaggedEntries';

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
