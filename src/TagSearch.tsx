import React, {useCallback, useEffect, useState} from 'react';
import StyledTagFormContainer from './styled/tags/StyledTagFormContainer';
import StyledTextFieldTags from './styled/tags/StyledTextFieldTags';
import {useAppContext} from './AppContext';

const TagSearch = () => {
  const [tagName, setTagName] = useState<string>('');
  const appConfig = useAppContext();

  const escFunction = useCallback(event => {
    if (event.keyCode === 27) {
      handleCancel();
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

  const handleTagNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTagName(event.currentTarget.value);
  };

  const handleCancel = () => {
    setTagName('');
    appConfig.setTagNew(null);
  };

  return (
    <StyledTagFormContainer>
      <StyledTextFieldTags
        value={tagName}
        id="tagNewTextField"
        onChange={e => {
          handleTagNameChange(e);
        }}
      />
    </StyledTagFormContainer>
  );
};
export default React.memo(TagSearch);
