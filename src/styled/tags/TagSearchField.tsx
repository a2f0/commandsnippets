import React, {useCallback, useEffect, useState} from 'react';
import StyledTextFieldTags from './StyledTextFieldTags';
import {keyCode} from '../../lib/shared';
import {useAppContext} from '../../AppContext';

const TagSearchField = () => {
  const [tagSearch, setTagSearch] = useState<string>('');
  const appConfig = useAppContext();

  const escFunction = useCallback(event => {
    if (event.keyCode === keyCode.Escape) {
      handleClear();
    }
  }, []);

  const useVisibility = useCallback(() => {
    if (document.visibilityState === 'visible') {
      console.info('the document has become visible');
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);
    document.addEventListener('visibilitychange', useVisibility, false);

    return () => {
      document.removeEventListener('keydown', escFunction, false);
      document.removeEventListener('visibilitychange', useVisibility, false);
    };
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagSearch(event.currentTarget.value);
    appConfig.setTagSearchString(event.currentTarget.value);
  };

  const handleClear = () => {
    setTagSearch('');
    appConfig.setTagSearchString('');
  };

  return (
    <StyledTextFieldTags
      value={tagSearch}
      id="tag-search"
      onChange={handleChange}
    />
  );
};

export default React.memo(TagSearchField);
