import React from "react";
import { makeStyles } from '@material-ui/core/styles';
import { useTheme } from '@material-ui/styles';
import {darkTheme } from './themes.js'
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import Brightness3Icon from '@material-ui/icons/Brightness3';

const useStyles = makeStyles({
  themeSwitcher: {
    height: 16,
  }
});

const ThemeSwitcher = React.memo(function ThemeSwitcher(props) {
  const theme = useTheme();
  const classes = useStyles();
  return (
    <>
      { theme == darkTheme
        ? <WbSunnyIcon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}} onClick={props.handleThemeSwitcher}/>
        : <Brightness3Icon className={classes.themeSwitcher} style={{color: theme.palette.text.primary}} onClick={props.handleThemeSwitcher}/>
      }
    </>    
  )
})
export default ThemeSwitcher