import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {useTypedTranslation} from '../../../i18n/hooks';
import {entrySearchMethod} from '../../../lib/shared';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const AllEntries = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {user} = useParams();
  const entriesFilter = searchParams.get('entries');

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${entrySearchMethod.allEntries}`}
      onClick={() => {
        onClose();
        if (user !== undefined) {
          navigate(`/${user}?entries=all`);
        }
      }}
    >
      <ListItemIcon>
        {entriesFilter === 'all' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('allEntries')}
    </StyledMenuItem>
  );
};

const memoizedAllEntries = React.memo(AllEntries);

export {memoizedAllEntries as AllEntries};
