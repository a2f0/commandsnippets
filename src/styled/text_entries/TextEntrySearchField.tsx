import React, {useCallback, useEffect, useState} from 'react';
import StyledTextFieldTextEntries from './StyledTextFieldTextEntries';
import {keyCode} from '../../lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

const TextEntrySearchField = () => {
  const appConfig = useAppContext();
  const [textEntrySearch, setTextEntrySearch] = useState<string>(
    appConfig.entrySearchString
  );

  useEffect(() => {
    setTextEntrySearch(appConfig.entrySearchString);
  }, [appConfig.entrySearchString]);

  const escFunction = useCallback(event => {
    if (event.keyCode === keyCode.Escape) {
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
  };

  return (
    <StyledTextFieldTextEntries
      value={textEntrySearch}
      id="text-entry-search"
      onChange={handleChange}
    />
  );
};

export default React.memo(observer(TextEntrySearchField));
