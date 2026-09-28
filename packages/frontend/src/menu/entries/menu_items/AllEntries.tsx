import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {entrySearchMethod} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const AllEntries = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {user} = useParams();
  const entriesFilter = searchParams.get('entries');

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${entrySearchMethod.allEntries}`}
      onClick={() => {
        onClose();
        // Pages without a user in the path (such as /admin) show the
        // signed-in user's entries.
        const owner = user ?? appConfig.loggedInUser;
        if (owner !== null) {
          navigate(`/${owner}?entries=all`);
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
