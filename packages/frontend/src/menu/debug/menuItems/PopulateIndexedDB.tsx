import React from 'react';
import {useParams} from 'react-router-dom';

import {useTypedTranslation} from '../../../i18n/hooks';
import {fetchAllEntriesForUser} from '../../../lib/textEntries';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const PopulateIndexedDB = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
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
      {t('populateIndexedDB')}
    </StyledMenuItem>
  );
};

const memoizedPopulateIndexedDB = React.memo(PopulateIndexedDB);

export {memoizedPopulateIndexedDB as PopulateIndexedDB};
