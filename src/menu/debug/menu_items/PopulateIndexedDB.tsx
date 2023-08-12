import React from 'react';
import StyledMenuItem from '../../../StyledMenuItem';
import {fetchAllEntriesForUser} from '../../../lib/text_entries';
import {useParams} from 'react-router-dom';

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
