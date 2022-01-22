import React, {useCallback, useEffect, useState} from 'react';
import StyledTextFieldTags from './StyledTextFieldTags';
import {activeSearch} from '../../lib/shared';
import {appMode} from '../../lib/shared';
import {keyCode} from '../../lib/shared';
import {observer} from 'mobx-react';
import {useAppContext} from '../../AppContext';

const TagSearchField = () => {
  const [tagSearch, setTagSearch] = useState<string>('');
  const appConfig = useAppContext();
  const inputRef = React.useRef<HTMLInputElement>();

  const escFunction = useCallback(event => {
    if (event.keyCode === keyCode.Escape) {
      appConfig.setAppMode(appMode.tagsList);
      inputRef.current?.focus();
      handleClear();
    }
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagSearch(event.currentTarget.value);
    appConfig.setTagSearchString(event.currentTarget.value);
  };

  useEffect(() => {
    document.addEventListener('keydown', escFunction, false);
    document.addEventListener('visibilitychange', useVisibility, false);
    document.addEventListener('focus', useWindowFocus, false);
    return () => {
      document.addEventListener('keydown', escFunction, false);
      document.removeEventListener('visibilitychange', useVisibility, false);
      document.removeEventListener('focus', useWindowFocus, false);
    };
  }, []);

  const useVisibility = useCallback(() => {
    if (document.visibilityState === 'visible') {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
    }
  }, []);

  const useWindowFocus = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.setSelectionRange(0, inputRef.current?.value.length);
  }, []);

  const setTextInputRef = (element: HTMLInputElement) => {
    inputRef.current = element;
  };

  useEffect(() => {
    if (appConfig.activeSearch === activeSearch.tags) {
      inputRef.current?.focus();
    }
  }, [appConfig.activeSearch]);

  const handleClear = () => {
    setTagSearch('');
    appConfig.setTagSearchString('');
  };

  return (
    <StyledTextFieldTags
      ref={setTextInputRef}
      value={tagSearch}
      id="tagSearch"
      onChange={handleChange}
    />
  );
};

export default React.memo(observer(TagSearchField));
