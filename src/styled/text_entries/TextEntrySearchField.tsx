import React, {useCallback, useEffect, useState} from 'react';
import StyledTextFieldTextEntries from './StyledTextFieldTextEntries';

const TextEntrySearchField = () => {
  const [textEntrySearch, setTextEntrySearch] = useState<string>('');

  const escFunction = useCallback(event => {
    if (event.keyCode === 27) {
      handleClear();
    }
  }, []);

  const useVisibility = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.info('the document has become visible');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('visibilitychange', useVisibility, false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.info('handling change');
    setTextEntrySearch(event.currentTarget.value);
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
