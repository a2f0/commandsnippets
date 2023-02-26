import {useNavigate, useParams, useSearchParams} from 'react-router-dom';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {entrySearchMethod} from '../../../lib/shared';

interface IProps {
  onClose: () => void;
}

const AllEntries = function ({onClose}: IProps) {
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
      All entries
    </StyledMenuItem>
  );
};

export default React.memo(AllEntries);
