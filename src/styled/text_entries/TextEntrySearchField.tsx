import React, {useCallback, useEffect, useState} from 'react';
import StyledTextFieldTextEntries from './StyledTextFieldTextEntries';
import {useAppContext} from '../../AppContext';

const TextEntrySearchField = () => {
  const [textEntrySearch, setTextEntrySearch] = useState<string>('');
  const appConfig = useAppContext();

  const escFunction = useCallback(event => {
    if (event.keyCode === 27) {
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
    setTextEntrySearch(event.currentTarget.value);
    appConfig.setEntrySearchString(event.currentTarget.value);
  };

  const handleClear = () => {
    setTextEntrySearch('');
  };

  return (
    <StyledTextFieldTextEntries
      value={textEntrySearch}
      id="text-entry-search"
      onChange={handleChange}
    />
  );
};

export default React.memo(TextEntrySearchField);
