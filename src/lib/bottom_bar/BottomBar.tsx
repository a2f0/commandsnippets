import {Box} from '@mui/material';
import Grid from '@mui/material/Grid2';
import Mode from './Mode';
import React from 'react';
import TagSearch from '../../TagSearch';
import TextEntrySearchField from '../../styled/text_entries/TextEntrySearchField';
import Version from './Version';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';

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
