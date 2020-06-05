import React from "react";
import Button from '@material-ui/core/Button';
import { useTheme } from '@material-ui/styles';
import {darkTheme } from './themes.js'
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import Brightness3Icon from '@material-ui/icons/Brightness3';

const ThemeSwitcher = React.memo(function ThemeSwitcher(props) {
  const theme = useTheme()
  return (
    <>
      { theme == darkTheme
        ? <WbSunnyIcon style={{color: theme.palette.text.primary}} onClick={props.handleThemeSwitcher}/>
        : <Brightness3Icon style={{color: theme.palette.text.primary}} onClick={props.handleThemeSwitcher}/>
      }
    </>    
  )
})
export default ThemeSwitcher