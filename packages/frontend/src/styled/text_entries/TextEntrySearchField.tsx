import {observer} from 'mobx-react';
import React, {useCallback, useEffect, useState} from 'react';

import {useAppContext} from '../../AppContext';
import {StyledTextFieldEntries} from './StyledTextFieldTextEntries';

const TextEntrySearchField = () => {
  const appConfig = useAppContext();
  const [textEntrySearch, setTextEntrySearch] = useState<string>(
    appConfig.entrySearchString
  );

  useEffect(() => {
    setTextEntrySearch(appConfig.entrySearchString);
  }, [appConfig.entrySearchString]);

  const escFunction = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Escape') {
      handleClear();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    appConfig.setEntrySearchString(event.currentTarget.value);
  };

  const handleClear = () => {
    setTextEntrySearch('');
    appConfig.setEntrySearchString('');
  };

  return (
    <StyledTextFieldEntries
      value={textEntrySearch}
      id="textEntrySearch"
      onChange={handleChange}
    />
  );
};

const memoizedTextEntrySearchField = React.memo(observer(TextEntrySearchField));

export {memoizedTextEntrySearchField as TextEntrySearchField};
