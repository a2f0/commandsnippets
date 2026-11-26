import {ListItemIcon} from '@mui/material';
import React from 'react';
import {type MenuKeys, useTypedTranslation} from '../../../i18n/hooks';
import type {EntryKindFilter} from '../../../lib/entryKind';
import {useAppState} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

const FILTERS: Record<EntryKindFilter, {id: string; label: MenuKeys}> = {
  all: {id: 'view-menu-entry-kind-all', label: 'allEntryKinds'},
  shortcut: {id: 'view-menu-entry-kind-shortcut', label: 'keyboardShortcuts'},
  snippet: {id: 'view-menu-entry-kind-snippet', label: 'textEntries'},
};

interface IProps {
  filter: EntryKindFilter;
  onClose: () => void;
}

/**
 * View > All Entry Types, Keyboard Shortcuts or Text Entries: which entries
 * the lists show and the tags count; checked while it is the one shown.
 */
const EntryKindFilterMenuItem = ({filter, onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const selected = useAppState(state => state.entryKindFilter === filter);
  const {id, label} = FILTERS[filter];

  return (
    <StyledMenuItem
      id={id}
      onClick={() => {
        onClose();
        useAppState.getState().setEntryKindFilter(filter);
      }}
    >
      <ListItemIcon>{selected && <StyledCheckIcon />}</ListItemIcon>
      {t(label)}
    </StyledMenuItem>
  );
};

const memoizedEntryKindFilterMenuItem = React.memo(EntryKindFilterMenuItem);

export {memoizedEntryKindFilterMenuItem as EntryKindFilterMenuItem};
