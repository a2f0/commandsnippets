import {Chip} from '@mui/material';
import {styled} from '@mui/material/styles';
import React from 'react';

import {useTypedTranslation} from '../../i18n/hooks';

const TagRow = styled('ul')(({theme}) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '4px',
  listStyle: 'none',
  margin: '4px 0 0',
  // Under the subject and body, past their drag and copy handles.
  padding: `0 0 0 ${theme.main.dragIndicatorWidth}px`,
  whiteSpace: 'normal',
}));

const chipSx = {
  height: 18,
  fontSize: '11px',
  color: 'text.secondary',
  borderColor: 'text.disabled',
  borderRadius: 1,
  '& .MuiChip-label': {px: '6px'},
} as const;

interface IProps {
  /** The names of the tags to show, in order. */
  names: readonly string[];
}

/** An entry's tags, under it in the list: labels only, not links. */
const EntryTags = ({names}: IProps) => {
  const {t} = useTypedTranslation('entries');

  return (
    <TagRow aria-label={t('entryTags')}>
      {names.map(name => (
        <li key={name}>
          <Chip label={name} size="small" variant="outlined" sx={chipSx} />
        </li>
      ))}
    </TagRow>
  );
};

export const MemoizedEntryTags = React.memo(EntryTags);
