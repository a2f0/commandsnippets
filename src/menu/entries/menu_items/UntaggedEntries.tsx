import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {entrySearchMethod} from '../../../lib/shared';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const UntaggedEntries = ({onClose}: IProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {user} = useParams();
  const entriesFilter = searchParams.get('entries');

  return (
    <StyledMenuItem
      id={`entries-menu-list-method-${entrySearchMethod.untaggedEntryList}`}
      onClick={() => {
        if (user !== undefined) {
          navigate(`/${user}?entries=untagged`);
        }
        onClose();
      }}
    >
      <ListItemIcon>
        {entriesFilter === 'untagged' && <StyledCheckIcon />}
      </ListItemIcon>
      Untagged Entries
    </StyledMenuItem>
  );
};

const memoizedUntaggedEntries = React.memo(UntaggedEntries);

export {memoizedUntaggedEntries as UntaggedEntries};
