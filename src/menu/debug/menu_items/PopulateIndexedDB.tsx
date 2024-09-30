import React from 'react';
import {useParams} from 'react-router-dom';

import {fetchAllEntriesForUser} from '../../../lib/text_entries';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const PopulateIndexedDB = function ({onClose}: IProps) {
  const {user} = useParams();

  return (
    <StyledMenuItem
      id="debug-menu-populate-indexed-db"
      key="Populate IndexedDB"
      onClick={() => {
        fetchAllEntriesForUser(user);
        onClose();
      }}
    >
      Populate IndexedDB
    </StyledMenuItem>
  );
};

export default React.memo(PopulateIndexedDB);
