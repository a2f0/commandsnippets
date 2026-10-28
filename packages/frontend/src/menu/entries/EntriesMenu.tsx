import React from 'react';

import {useEntrySortOrder} from '../../hooks/useEntrySortOrder';
import {useSearchParam} from '../../lib/router/navigation';
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
  // The subject, body, date created and tag count items sort the list on
  // screen (useEntrySortOrder). The untagged and all-entries lists have no
  // tag order, so only a tag's list offers those sorts; the untagged list's
  // entries all have no tags, so it has no tag count sort.
  const {tagList} = useEntrySortOrder();
  const untaggedList = useSearchParam('entries') === 'untagged';
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
      {tagList && [
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
      {!untaggedList && [
        <SortByTagCountDescending
          onClose={onClose}
          key="SortTagCountDescending"
        />,
        <SortByTagCountAscending
          onClose={onClose}
          key="SortTagCountAscending"
        />,
      ]}
    </StyledMenu>
  );
};

const memoizedEntriesMenu = React.memo(EntriesMenu);

export {memoizedEntriesMenu as EntriesMenu};
