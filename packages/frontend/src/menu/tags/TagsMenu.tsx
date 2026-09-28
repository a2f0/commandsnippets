import React from 'react';

import {StyledMenu} from '../StyledMenu';
import {SortByDateCreatedAscending} from './menuItems/SortByDateCreatedAscending';
import {SortByDateCreatedDescending} from './menuItems/SortByDateCreatedDescending';
import {SortByDateLastUsedAscending} from './menuItems/SortByDateLastUsedAscending';
import {SortByDateLastUsedDescending} from './menuItems/SortByDateLastUsedDescending';
import {SortByEntryCountAscending} from './menuItems/SortByEntryCountAscending';
import {SortByEntryCountDescending} from './menuItems/SortByEntryCountDescending';
import {SortByNameAscending} from './menuItems/SortByNameAscending';
import {SortByNameDescending} from './menuItems/SortByNameDescending';
import {SortByUserDefinedOrder} from './menuItems/SortByUserDefinedOrder';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const TagsMenu = ({onClose, anchorEl}: IProps) => (
  <StyledMenu
    id="tags-menu"
    anchorEl={anchorEl}
    open={Boolean(anchorEl)}
    onClose={onClose}
  >
    <SortByUserDefinedOrder onClose={onClose} />
    <SortByNameDescending onClose={onClose} />
    <SortByNameAscending onClose={onClose} />
    <SortByDateCreatedDescending onClose={onClose} />
    <SortByDateCreatedAscending onClose={onClose} />
    <SortByEntryCountDescending onClose={onClose} />
    <SortByEntryCountAscending onClose={onClose} />
    <SortByDateLastUsedDescending onClose={onClose} />
    <SortByDateLastUsedAscending onClose={onClose} />
  </StyledMenu>
);

const memoizedTagsMenu = React.memo(TagsMenu);

export {memoizedTagsMenu as TagsMenu};
