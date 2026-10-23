import {styled} from '@mui/material/styles';
import React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';

const ReuseCount = styled('span')(({theme}) => ({
  marginLeft: '8px',
  fontSize: 12,
  color: theme.palette.text.secondary,
}));

export interface IProps {
  /** The entry's `reused_count`: the times it was reused. */
  count: number;
}

/** How many times an entry was reused, shown beside its subject. */
const EntryReuseCount = ({count}: IProps) => {
  const {t} = useTypedTranslation('entries');
  return (
    <ReuseCount title={t('reusedCount', {count})}>{`${count}×`}</ReuseCount>
  );
};

export const MemoizedEntryReuseCount = React.memo(EntryReuseCount);
