import React from 'react';

import {StyledTagFormContainer} from './StyledTagFormContainer';
import {TagSearchField} from './TagSearchField';

const TagSearch = () => {
  return (
    <StyledTagFormContainer id="tagSearchContainer">
      <TagSearchField />
    </StyledTagFormContainer>
  );
};

const memoizedTagSearch = React.memo(TagSearch);

export {memoizedTagSearch as TagSearch};
