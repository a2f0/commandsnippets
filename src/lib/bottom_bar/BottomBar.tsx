import {Box} from '@mui/material';
import Grid from '@mui/material/Grid2';
import {styled} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';

import TextEntrySearchField from '../../styled/text_entries/TextEntrySearchField';
import TagSearch from '../../TagSearch';
import Mode from './Mode';
import Version from './Version';

const Aligner = styled('div')`
  display: flex;
`;

const BottomBar = () => {
  return (
    <>
      <Aligner>
        <TagSearch /> <TextEntrySearchField />
      </Aligner>
      <Grid
        container
        justifyContent="flex-end"
        flex={1}
        sx={{
          height: theme => theme.footer.height,
        }}
      >
        <Box
          sx={{
            height: theme => theme.footer.height,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <Mode />
          {/* <TagCount /> */}
          <Version />
        </Box>
      </Grid>
    </>
  );
};
export default React.memo(observer(BottomBar));
