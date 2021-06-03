import React from 'react';
import {makeStyles} from '@material-ui/core/styles';
import {useTheme} from '@material-ui/styles';
import {darkTheme, lightTheme} from './themes';
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import Brightness3Icon from '@material-ui/icons/Brightness3';
import {Theme} from '@material-ui/core/styles';

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
