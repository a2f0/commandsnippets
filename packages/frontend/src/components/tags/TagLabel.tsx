import React from 'react';
import Highlighter from 'react-highlight-words';

import {useAppState} from '../../lib/state/appState';

interface IProps {
  label: string;
}

const TagLabel = ({label}: IProps) => {
  const tagSearchString = useAppState(state => state.tagSearchString);

  return (
    <Highlighter
      searchWords={[tagSearchString]}
      autoEscape={true}
      textToHighlight={label}
    />
  );
};

const memoizedTagLabel = React.memo(TagLabel);

export {memoizedTagLabel as TagLabel};
