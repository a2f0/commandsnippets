import {darkTheme, lightTheme} from './themes';
import Brightness3Icon from '@mui/icons-material/Brightness3';
import React from 'react';
import {Theme} from '@mui/material/styles';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import makeStyles from '@mui/styles/makeStyles';
import {useTheme} from '@mui/styles';

const useStyles = makeStyles({
  themeSwitcher: {
    height: 16,
  },
});

interface IThemeSwitcherProps {
  handleThemeSwitcher: (chosenTheme: Theme) => void;
}

const ThemeSwitcher = (props: IThemeSwitcherProps) => {
  const theme = useTheme<Theme>();
  const classes = useStyles();
  return (
    <>
      {theme === darkTheme ? (
        <WbSunnyIcon
          className={classes.themeSwitcher}
          style={{color: theme.palette.text.primary}}
          onClick={() => {
            props.handleThemeSwitcher(lightTheme);
          }}
        />
      ) : (
        <Brightness3Icon
          className={classes.themeSwitcher}
          style={{color: theme.palette.text.primary}}
          onClick={() => {
            props.handleThemeSwitcher(darkTheme);
          }}
        />
      )}
    </>
  );
};
export default React.memo(ThemeSwitcher);
