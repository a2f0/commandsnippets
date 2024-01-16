import {Box} from '@mui/material';
import {Grid} from '@mui/material';
import Mode from './Mode';
import React from 'react';
import TagSearch from '../../TagSearch';
import TextEntrySearchField from '../../styled/text_entries/TextEntrySearchField';
import {Theme} from '@mui/material/styles';
import Version from './Version';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';

interface AlignerIProps {
  theme: Theme;
}

const Aligner = styled('div')<AlignerIProps>`
  display: flex;
`;

const BottomBar = () => {
  const theme = useTheme();
  return (
    <>
      <Aligner theme={theme}>
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
