import React from 'react';

import {StyledTagFormContainer} from './styled/tags/StyledTagFormContainer';
import {TagSearchField} from './styled/tags/TagSearchField';

const TagSearch = () => {
  return (
    <StyledTagFormContainer id="tagSearchContainer">
      <TagSearchField />
    </StyledTagFormContainer>
  );
};

const memoizedTagSearch = React.memo(TagSearch);

export {memoizedTagSearch as TagSearch};
