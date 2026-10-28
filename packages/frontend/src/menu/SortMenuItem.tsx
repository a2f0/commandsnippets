import ArrowDownward from '@mui/icons-material/ArrowDownward';
import ArrowUpward from '@mui/icons-material/ArrowUpward';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {type MenuKeys, useTypedTranslation} from '../i18n/hooks';
import {StyledCheckIcon} from '../styled/StyledCheckIcon';
import {StyledMenuItem} from './StyledMenuItem';

/** A field a list sorts by, as its sort order names it, and its label. */
export interface ISort {
  field: string;
  label: MenuKeys;
}

/** What a menu's sort items share. */
export interface ISorting {
  /**
   * The start of each item's id, followed by the field (dashed) and the
   * direction: `tags-menu-sort` gives `tags-menu-sort-date-created-ascending`.
   */
  idPrefix: string;
  /** The order the list sorts by now, whose item is checked. */
  current: string;
  /** Sets the list's order: the field, after a `-` for descending. */
  onSelect: (order: string) => void;
  onClose: () => void;
}

type Direction = 'descending' | 'ascending';

const ARROWS = {descending: ArrowDownward, ascending: ArrowUpward};

interface IProps extends ISort, ISorting {
  /** None for the user-defined order (`order`), which has no arrow. */
  direction?: Direction;
}

/** A Tags or Entries menu item that sorts the list by a field. */
const SortMenuItem = ({
  field,
  label,
  direction,
  idPrefix,
  current,
  onSelect,
  onClose,
}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const order = direction === 'descending' ? `-${field}` : field;
  const id = `${idPrefix}-${field.replaceAll('_', '-')}`;
  const Arrow = direction && ARROWS[direction];

  return (
    <StyledMenuItem
      id={direction ? `${id}-${direction}` : id}
      onClick={() => {
        onSelect(order);
        onClose();
      }}
    >
      <ListItemIcon>{current === order && <StyledCheckIcon />}</ListItemIcon>
      {t(label)}
      {Arrow && <Arrow fontSize="small" />}
    </StyledMenuItem>
  );
};

const MemoizedSortMenuItem = React.memo(SortMenuItem);

const BOTH_WAYS: Direction[] = ['descending', 'ascending'];

/** The items of `sorts`, each both ways: descending, then ascending. */
function sortMenuItems(sorts: ISort[], sorting: ISorting) {
  return sorts.flatMap(sort =>
    BOTH_WAYS.map(direction => (
      <MemoizedSortMenuItem
        key={`${sort.field}-${direction}`}
        {...sort}
        {...sorting}
        direction={direction}
      />
    ))
  );
}

export {MemoizedSortMenuItem as SortMenuItem, sortMenuItems};
