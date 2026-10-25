import {Box} from '@mui/material';
import React from 'react';
import {SIDEBAR_WIDTH} from '../../lib/sidebarWidth';
import {TagSearchField} from './TagSearchField';

const TagSearch = () => {
  return (
    <Box
      id="tagSearchContainer"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        pl: theme => `${theme.main.dragIndicatorWidth}px`,
        '& .MuiTextField-root': {width: '100%'},
      }}
    >
      <TagSearchField />
    </Box>
  );
};

const memoizedTagSearch = React.memo(TagSearch);

export {memoizedTagSearch as TagSearch};
