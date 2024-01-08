import {Box} from '@mui/material';
import {Grid} from '@mui/material';
import React from 'react';
import TagSearch from './TagSearch';
import TextEntrySearchField from './styled/text_entries/TextEntrySearchField';
import {Theme} from '@mui/material/styles';
import {Typography} from '@mui/material';
import {observer} from 'mobx-react';
import packageJson from '../package.json';
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
            mr: theme => theme.spacing(0.5),
            height: theme => theme.footer.height,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <Typography variant="subtitle2">{packageJson.version}</Typography>
        </Box>
      </Grid>
    </>
  );
};
export default React.memo(observer(BottomBar));
