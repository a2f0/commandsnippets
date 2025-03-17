import React from 'react';

import {StyledMenu} from '../../MenuBar';
import SortByDateCreatedAscending from './menu_items/SortByDateCreatedAscending';
import SortByDateCreatedDescending from './menu_items/SortByDateCreatedDescending';
import SortByDateLastUsedAscending from './menu_items/SortByDateLastUsedAscending';
import SortByDateLastUsedDescending from './menu_items/SortByDateLastUsedDescending';
import SortByEntryCountAscending from './menu_items/SortByEntryCountAscending';
import SortByEntryCountDescending from './menu_items/SortByEntryCountDescending';
import SortByNameAscending from './menu_items/SortByNameAscending';
import SortByNameDescending from './menu_items/SortByNameDescending';
import SortByUserDefinedOrder from './menu_items/SortByUserDefinedOrder';

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

export default React.memo(TagsMenu);
